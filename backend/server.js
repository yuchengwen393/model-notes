/**
 * 模型手记内容后端（Node.js 版）。
 *
 * 职责：
 * 1. 托管 blog/ 下的静态页面；
 * 2. 提供站点、项目、文章的公开读取 API；
 * 3. 提供带管理口令的内容管理 API。
 *
 * 存储使用 Node.js 内置的 node:sqlite（Node 24+），
 * 与旧版 Flask 后端共用 backend/blog.db，切换运行时不会丢失已修改的数据。
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// ---------------------------------------------------------------------------
// 路径与运行参数
// ---------------------------------------------------------------------------

const BASE_DIR = __dirname;
const BLOG_DIR = path.resolve(BASE_DIR, '..');
const DATA_DIR = path.join(BLOG_DIR, 'data');
const POSTS_DIR = path.join(BLOG_DIR, 'posts');
const DB_PATH = path.join(BASE_DIR, 'blog.db');
const TOKEN_FILE = path.join(BASE_DIR, 'admin_token.txt');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8100);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

// 管理口令：环境变量优先，其次读取本地文件，最后随机生成。
let adminToken = (process.env.BLOG_ADMIN_TOKEN || '').trim();

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

/** 带 HTTP 状态码的业务异常。 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** 读取管理口令；首次启动时生成并写入文件。 */
function getAdminToken() {
  if (adminToken) return adminToken;
  if (fs.existsSync(TOKEN_FILE)) {
    adminToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (adminToken) return adminToken;
  }
  adminToken = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(TOKEN_FILE, adminToken, { encoding: 'utf8', mode: 0o600 });
  return adminToken;
}

/** 定长比较，避免口令比较时泄露长度与内容差异。 */
function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 判断请求是否通过管理口令校验。 */
function isAdmin(req) {
  const provided = req.headers['x-admin-token'];
  if (typeof provided !== 'string' || !provided) return false;
  return safeEqual(provided, getAdminToken());
}

/** 读取 JSON 文件，失败时返回默认值。 */
function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/** 只允许字母、数字、点、下划线与短横线作为资源 id，避免路径注入。 */
function isValidId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(value);
}

/** 将请求体解析为 JSON 对象，并限制最大体积。 */
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, '请求体过大。');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '请求体必须是合法 JSON。');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, '请求体必须是 JSON 对象。');
  }
  return parsed;
}

/** 写入 JSON 响应。 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/** 写入纯文本响应。 */
function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

/** 统一添加 CORS 响应头。 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}

// ---------------------------------------------------------------------------
// 数据库
// ---------------------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/** 建表，并在表为空时从 data/ 与 posts/ 播种。 */
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      content TEXT NOT NULL
    );
  `);

  const siteCount = db.prepare('SELECT COUNT(*) AS n FROM site').get().n;
  if (!siteCount) {
    const site = readJsonFile(path.join(DATA_DIR, 'site.json'), {});
    db.prepare('INSERT INTO site (id, data) VALUES (1, ?)').run(JSON.stringify(site));
  } else {
    // 旧数据库补上新增字段（如个人信息 profile），不覆盖已有内容。
    const row = db.prepare('SELECT data FROM site WHERE id = 1').get();
    const current = JSON.parse(row.data);
    const defaults = readJsonFile(path.join(DATA_DIR, 'site.json'), {});
    let changed = false;
    for (const [key, value] of Object.entries(defaults)) {
      if (current[key] === undefined) {
        current[key] = value;
        changed = true;
      }
    }
    if (defaults.profile && typeof defaults.profile === 'object') {
      if (!current.profile || typeof current.profile !== 'object') {
        current.profile = { ...defaults.profile };
        changed = true;
      } else {
        for (const [key, value] of Object.entries(defaults.profile)) {
          if (current.profile[key] === undefined) {
            current.profile[key] = value;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      db.prepare('UPDATE site SET data = ? WHERE id = 1').run(JSON.stringify(current));
    }
  }

  const projectCount = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  if (!projectCount) {
    const payload = readJsonFile(path.join(DATA_DIR, 'projects.json'), { projects: [] });
    const insert = db.prepare('INSERT INTO projects (id, sort_order, data) VALUES (?, ?, ?)');
    (payload.projects || []).forEach((item, index) => {
      const id = item.id || `project-${index}`;
      insert.run(id, index, JSON.stringify(item));
    });
  }

  const postCount = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
  if (!postCount) {
    const payload = readJsonFile(path.join(DATA_DIR, 'posts.json'), { posts: [] });
    const insert = db.prepare('INSERT INTO posts (id, sort_order, data, content) VALUES (?, ?, ?, ?)');
    (payload.posts || []).forEach((item, index) => {
      const id = item.id || `post-${index}`;
      const markdownPath = path.join(POSTS_DIR, `${id}.md`);
      const content = fs.existsSync(markdownPath) ? fs.readFileSync(markdownPath, 'utf8') : '';
      insert.run(id, index, JSON.stringify(item), content);
    });
  }
}

/** 读取站点信息。 */
function getSite() {
  const row = db.prepare('SELECT data FROM site WHERE id = 1').get();
  return row ? JSON.parse(row.data) : {};
}

/** 数据库行转项目对象。 */
function rowToProject(row) {
  return { ...JSON.parse(row.data), id: row.id };
}

/** 数据库行转文章元数据。 */
function rowToPost(row) {
  return { ...JSON.parse(row.data), id: row.id };
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/** GET /api/health：服务状态。 */
function handleHealth(res) {
  sendJson(res, 200, {
    status: 'ok',
    service: 'model-notes-content-node',
    runtime: process.version,
    database: path.basename(DB_PATH),
  });
}

/** GET /api/site：站点信息（含个人信息 profile）。 */
function handleGetSite(res) {
  sendJson(res, 200, getSite());
}

/** GET /api/projects：项目列表。 */
function handleGetProjects(res) {
  const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, id ASC').all();
  sendJson(res, 200, { projects: rows.map(rowToProject) });
}

/** GET /api/posts：站点信息与全部文章元数据。 */
function handleGetPosts(res) {
  const rows = db.prepare('SELECT * FROM posts ORDER BY sort_order ASC, id ASC').all();
  sendJson(res, 200, { site: getSite(), posts: rows.map(rowToPost) });
}

/** GET /api/posts/:id：单篇文章元数据与 Markdown 正文。 */
function handleGetPost(res, id) {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!row) {
    sendJson(res, 404, { error: '文章不存在。' });
    return;
  }
  sendJson(res, 200, { post: rowToPost(row), content: row.content });
}

// ---------------------------------------------------------------------------
// 管理 API
// ---------------------------------------------------------------------------

/** 校验请求是否带正确的管理口令。 */
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: '管理口令不正确。' });
  return false;
}

/** PUT /api/admin/site：保存站点信息，保留未提交的字段。 */
async function handleUpdateSite(req, res) {
  const payload = await readJsonBody(req);
  const current = getSite();
  const next = { ...current, ...payload };
  if (payload.profile && typeof payload.profile === 'object') {
    next.profile = { ...(current.profile || {}), ...payload.profile };
  }
  db.prepare('UPDATE site SET data = ? WHERE id = 1').run(JSON.stringify(next));
  sendJson(res, 200, next);
}

/** PUT /api/admin/profile：只更新个人信息，不影响站点其他字段。 */
async function handleUpdateProfile(req, res) {
  const payload = await readJsonBody(req);
  const site = getSite();
  site.profile = { ...(site.profile || {}), ...payload };
  db.prepare('UPDATE site SET data = ? WHERE id = 1').run(JSON.stringify(site));
  sendJson(res, 200, site.profile);
}

/** POST /api/admin/projects：新增项目。 */
async function handleCreateProject(req, res) {
  const payload = await readJsonBody(req);
  if (!isValidId(payload.id) || typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new HttpError(400, '项目需要合法的 id 与 title。');
  }
  if (db.prepare('SELECT 1 FROM projects WHERE id = ?').get(payload.id)) {
    throw new HttpError(409, '项目 id 已存在。');
  }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS n FROM projects').get().n;
  db.prepare('INSERT INTO projects (id, sort_order, data) VALUES (?, ?, ?)').run(
    payload.id,
    maxOrder + 1,
    JSON.stringify(payload),
  );
  sendJson(res, 201, payload);
}

/** PUT /api/admin/projects/:id：更新项目。 */
async function handleUpdateProject(req, res, id) {
  const payload = await readJsonBody(req);
  if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) {
    throw new HttpError(404, '项目不存在。');
  }
  const next = { ...payload, id };
  db.prepare('UPDATE projects SET data = ? WHERE id = ?').run(JSON.stringify(next), id);
  sendJson(res, 200, next);
}

/** DELETE /api/admin/projects/:id：删除项目。 */
function handleDeleteProject(res, id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
}

/** POST /api/admin/posts：新增文章，默认排到最前。 */
async function handleCreatePost(req, res) {
  const payload = await readJsonBody(req);
  if (!isValidId(payload.id) || typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new HttpError(400, '文章需要合法的 id 与 title。');
  }
  if (db.prepare('SELECT 1 FROM posts WHERE id = ?').get(payload.id)) {
    throw new HttpError(409, '文章 id 已存在。');
  }
  const content = typeof payload.content === 'string' ? payload.content : '';
  delete payload.content;
  const minOrder = db.prepare('SELECT COALESCE(MIN(sort_order), 0) AS n FROM posts').get().n;
  db.prepare('INSERT INTO posts (id, sort_order, data, content) VALUES (?, ?, ?, ?)').run(
    payload.id,
    minOrder - 1,
    JSON.stringify(payload),
    content,
  );
  sendJson(res, 201, { ...payload, content });
}

/** PUT /api/admin/posts/:id：更新文章，未传 content 时保留原正文。 */
async function handleUpdatePost(req, res, id) {
  const payload = await readJsonBody(req);
  const row = db.prepare('SELECT content FROM posts WHERE id = ?').get(id);
  if (!row) {
    throw new HttpError(404, '文章不存在。');
  }
  const content = typeof payload.content === 'string' ? payload.content : row.content;
  delete payload.content;
  const next = { ...payload, id };
  db.prepare('UPDATE posts SET data = ?, content = ? WHERE id = ?').run(
    JSON.stringify(next),
    content,
    id,
  );
  sendJson(res, 200, { ...next, content });
}

/** DELETE /api/admin/posts/:id：删除文章。 */
function handleDeletePost(res, id) {
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  sendJson(res, 200, { ok: true });
}

// ---------------------------------------------------------------------------
// 静态文件
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** 判断静态路径是否属于禁止访问的目录或文件。 */
function isBlockedStaticPath(relativePath) {
  const segments = relativePath.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.'))) return true;
  if (segments[0] === 'backend') return true;
  if (segments[0] === 'node_modules') return true;
  return false;
}

/** 托管 blog/ 下的静态文件。 */
async function serveStatic(req, res, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    sendText(res, 400, '路径编码不正确。');
    return;
  }
  if (!relativePath) relativePath = 'index.html';
  if (isBlockedStaticPath(relativePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  let filePath = path.resolve(BLOG_DIR, relativePath);
  const allowedPrefix = BLOG_DIR + path.sep;
  if (filePath !== BLOG_DIR && !filePath.startsWith(allowedPrefix)) {
    sendText(res, 404, 'Not found');
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const content = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=60',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    const notFoundPage = path.join(BLOG_DIR, '404.html');
    if (fs.existsSync(notFoundPage)) {
      const content = await fsp.readFile(notFoundPage);
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': content.length,
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } else {
      sendText(res, 404, 'Not found');
    }
  }
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

/** 处理一次 HTTP 请求。 */
async function handleRequest(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const pathname = url.pathname;

  // 公开接口
  if (pathname === '/api/health' && req.method === 'GET') return handleHealth(res);
  if (pathname === '/api/site' && req.method === 'GET') return handleGetSite(res);
  if (pathname === '/api/projects' && req.method === 'GET') return handleGetProjects(res);
  if (pathname === '/api/posts' && req.method === 'GET') return handleGetPosts(res);

  const publicPostMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (publicPostMatch && req.method === 'GET') {
    return handleGetPost(res, decodeURIComponent(publicPostMatch[1]));
  }

  // 管理接口：先校验口令，再解析请求体
  if (pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(req, res)) return;

    if (pathname === '/api/admin/session' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/site' && req.method === 'PUT') {
      return handleUpdateSite(req, res);
    }
    if (pathname === '/api/admin/profile' && req.method === 'PUT') {
      return handleUpdateProfile(req, res);
    }
    if (pathname === '/api/admin/projects' && req.method === 'POST') {
      return handleCreateProject(req, res);
    }
    if (pathname === '/api/admin/posts' && req.method === 'POST') {
      return handleCreatePost(req, res);
    }

    const projectMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
    if (projectMatch) {
      const id = decodeURIComponent(projectMatch[1]);
      if (req.method === 'PUT') return handleUpdateProject(req, res, id);
      if (req.method === 'DELETE') return handleDeleteProject(res, id);
    }

    const postMatch = pathname.match(/^\/api\/admin\/posts\/([^/]+)$/);
    if (postMatch) {
      const id = decodeURIComponent(postMatch[1]);
      if (req.method === 'PUT') return handleUpdatePost(req, res, id);
      if (req.method === 'DELETE') return handleDeletePost(res, id);
    }

    sendJson(res, 404, { error: '接口不存在。', path: pathname });
    return;
  }

  // 未知 API 统一返回 JSON
  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: '接口不存在。', path: pathname });
    return;
  }

  // 其余路径按静态文件处理
  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }

  sendText(res, 405, 'Method Not Allowed');
}

// ---------------------------------------------------------------------------
// 启动与退出
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : '服务器内部错误。';
    if (status >= 500) console.error('[blog-node] 请求失败：', error);
    if (!res.headersSent) sendJson(res, status, { error: message });
    else res.end();
  });
});

/** 初始化数据库并监听端口。 */
function start() {
  initDatabase();
  getAdminToken();
  server.listen(PORT, HOST, () => {
    console.log(`[blog-node] 服务地址 http://${HOST}:${PORT}`);
    console.log(`[blog-node] 数据库 ${DB_PATH}`);
    console.log(`[blog-node] 管理口令文件 ${TOKEN_FILE}`);
  });
}

/** 退出前关闭 HTTP 服务与数据库。 */
function shutdown(signal) {
  console.log(`[blog-node] 收到 ${signal}，正在退出。`);
  server.close(() => {
    try {
      db.close();
    } catch {
      /* 数据库可能已经关闭。 */
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
