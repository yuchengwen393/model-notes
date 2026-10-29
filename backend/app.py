"""模型手记内容后端。

Flask + SQLite：为静态博客提供站点信息、项目与文章 API，
同时提供带管理口令的内容管理接口。静态页面仍由同一进程托管，
因此本地访问 http://127.0.0.1:8100/ 即可同时使用页面和 API。
"""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
BLOG_DIR = BASE_DIR.parent
DATA_DIR = BLOG_DIR / "data"
POSTS_DIR = BLOG_DIR / "posts"
DB_PATH = BASE_DIR / "blog.db"
TOKEN_FILE = BASE_DIR / "admin_token.txt"
ADMIN_TOKEN = os.environ.get("BLOG_ADMIN_TOKEN", "").strip()


def get_admin_token() -> str:
    """优先使用环境变量；否则首次启动生成随机口令并写入本地文件。"""
    global ADMIN_TOKEN
    if ADMIN_TOKEN:
        return ADMIN_TOKEN
    if TOKEN_FILE.exists():
        ADMIN_TOKEN = TOKEN_FILE.read_text(encoding="utf-8").strip()
        return ADMIN_TOKEN
    ADMIN_TOKEN = secrets.token_urlsafe(18)
    TOKEN_FILE.write_text(ADMIN_TOKEN, encoding="utf-8")
    return ADMIN_TOKEN


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as conn:
        conn.executescript(
            """
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
            """
        )
        site_count = conn.execute("SELECT COUNT(*) AS n FROM site").fetchone()["n"]
        if not site_count:
            site = read_json(DATA_DIR / "site.json", {})
            conn.execute(
                "INSERT INTO site (id, data) VALUES (1, ?)",
                (json.dumps(site, ensure_ascii=False),),
            )

        project_count = conn.execute("SELECT COUNT(*) AS n FROM projects").fetchone()["n"]
        if not project_count:
            payload = read_json(DATA_DIR / "projects.json", {"projects": []})
            for index, item in enumerate(payload.get("projects", [])):
                conn.execute(
                    "INSERT INTO projects (id, sort_order, data) VALUES (?, ?, ?)",
                    (item.get("id", f"project-{index}"), index, json.dumps(item, ensure_ascii=False)),
                )

        post_count = conn.execute("SELECT COUNT(*) AS n FROM posts").fetchone()["n"]
        if not post_count:
            payload = read_json(DATA_DIR / "posts.json", {"posts": []})
            for index, item in enumerate(payload.get("posts", [])):
                post_id = item.get("id", f"post-{index}")
                md_path = POSTS_DIR / f"{post_id}.md"
                content = md_path.read_text(encoding="utf-8") if md_path.exists() else ""
                conn.execute(
                    "INSERT INTO posts (id, sort_order, data, content) VALUES (?, ?, ?, ?)",
                    (post_id, index, json.dumps(item, ensure_ascii=False), content),
                )
        conn.commit()


app = Flask(__name__, static_folder=str(BLOG_DIR), static_url_path="")


@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        return ("", 204)


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Token"
    return response


def require_admin(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get("X-Admin-Token", "")
        if not token or not secrets.compare_digest(token, get_admin_token()):
            return jsonify({"error": "管理口令不正确。"}), 401
        return func(*args, **kwargs)

    return wrapper


def row_to_project(row):
    data = json.loads(row["data"])
    data["id"] = row["id"]
    return data


def row_to_post(row):
    data = json.loads(row["data"])
    data["id"] = row["id"]
    return data


def site_data():
    with db() as conn:
        row = conn.execute("SELECT data FROM site WHERE id = 1").fetchone()
    return json.loads(row["data"]) if row else {}


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "model-notes-content", "database": DB_PATH.name})


@app.route("/api/site")
def get_site():
    return jsonify(site_data())


@app.route("/api/posts")
def get_posts():
    with db() as conn:
        rows = conn.execute("SELECT * FROM posts ORDER BY sort_order ASC, id ASC").fetchall()
    return jsonify({"site": site_data(), "posts": [row_to_post(row) for row in rows]})


@app.route("/api/posts/<post_id>")
def get_post(post_id):
    with db() as conn:
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None:
        return jsonify({"error": "文章不存在。"}), 404
    return jsonify({"post": row_to_post(row), "content": row["content"]})


@app.route("/api/projects")
def get_projects():
    with db() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY sort_order ASC, id ASC").fetchall()
    return jsonify({"projects": [row_to_project(row) for row in rows]})


@app.route("/api/admin/session")
@require_admin
def admin_session():
    return jsonify({"ok": True})


@app.route("/api/admin/site", methods=["PUT"])
@require_admin
def update_site():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "site 必须是 JSON 对象。"}), 400
    with db() as conn:
        conn.execute(
            "UPDATE site SET data = ? WHERE id = 1",
            (json.dumps(payload, ensure_ascii=False),),
        )
        conn.commit()
    return jsonify(payload)


@app.route("/api/admin/projects", methods=["POST"])
@require_admin
def create_project():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not payload.get("id") or not payload.get("title"):
        return jsonify({"error": "项目需要 id 与 title。"}), 400
    with db() as conn:
        exists = conn.execute("SELECT 1 FROM projects WHERE id = ?", (payload["id"],)).fetchone()
        if exists:
            return jsonify({"error": "项目 id 已存在。"}), 409
        max_order = conn.execute("SELECT COALESCE(MAX(sort_order), -1) AS n FROM projects").fetchone()["n"]
        conn.execute(
            "INSERT INTO projects (id, sort_order, data) VALUES (?, ?, ?)",
            (payload["id"], max_order + 1, json.dumps(payload, ensure_ascii=False)),
        )
        conn.commit()
    return jsonify(payload), 201


@app.route("/api/admin/projects/<project_id>", methods=["PUT"])
@require_admin
def update_project(project_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "项目必须是 JSON 对象。"}), 400
    payload["id"] = project_id
    with db() as conn:
        row = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row is None:
            return jsonify({"error": "项目不存在。"}), 404
        conn.execute(
            "UPDATE projects SET data = ? WHERE id = ?",
            (json.dumps(payload, ensure_ascii=False), project_id),
        )
        conn.commit()
    return jsonify(payload)


@app.route("/api/admin/projects/<project_id>", methods=["DELETE"])
@require_admin
def delete_project(project_id):
    with db() as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/admin/posts", methods=["POST"])
@require_admin
def create_post():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not payload.get("id") or not payload.get("title"):
        return jsonify({"error": "文章需要 id 与 title。"}), 400
    content = payload.pop("content", "")
    with db() as conn:
        exists = conn.execute("SELECT 1 FROM posts WHERE id = ?", (payload["id"],)).fetchone()
        if exists:
            return jsonify({"error": "文章 id 已存在。"}), 409
        min_order = conn.execute("SELECT COALESCE(MIN(sort_order), 0) AS n FROM posts").fetchone()["n"]
        conn.execute(
            "INSERT INTO posts (id, sort_order, data, content) VALUES (?, ?, ?, ?)",
            (payload["id"], min_order - 1, json.dumps(payload, ensure_ascii=False), content),
        )
        conn.commit()
    return jsonify({**payload, "content": content}), 201


@app.route("/api/admin/posts/<post_id>", methods=["PUT"])
@require_admin
def update_post(post_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "文章必须是 JSON 对象。"}), 400
    payload["id"] = post_id
    content = payload.pop("content", None)
    with db() as conn:
        row = conn.execute("SELECT content FROM posts WHERE id = ?", (post_id,)).fetchone()
        if row is None:
            return jsonify({"error": "文章不存在。"}), 404
        if content is None:
            content = row["content"]
        conn.execute(
            "UPDATE posts SET data = ?, content = ? WHERE id = ?",
            (json.dumps(payload, ensure_ascii=False), content, post_id),
        )
        conn.commit()
    return jsonify({**payload, "content": content})


@app.route("/api/admin/posts/<post_id>", methods=["DELETE"])
@require_admin
def delete_post(post_id):
    with db() as conn:
        conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/")
def index():
    return send_from_directory(BLOG_DIR, "index.html")


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "接口不存在。", "path": request.path}), 404
    return send_from_directory(BLOG_DIR, "404.html") if (BLOG_DIR / "404.html").exists() else ("Not found", 404)


if __name__ == "__main__":
    init_db()
    get_admin_token()
    port = int(os.environ.get("PORT", "8100"))
    print(f"[blog-api] database={DB_PATH}")
    print(f"[blog-api] admin token file={TOKEN_FILE}")
    app.run(host="127.0.0.1", port=port, threaded=True)
