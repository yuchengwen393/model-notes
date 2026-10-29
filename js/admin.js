/* 模型手记内容管理：调用 Node.js 内容 API，口令保存在 sessionStorage。 */
(function () {
  const tokenInput = document.getElementById("tokenInput");
  const tokenStatus = document.getElementById("tokenStatus");
  const siteCard = document.getElementById("siteCard");
  const profileCard = document.getElementById("profileCard");
  const projectCard = document.getElementById("projectCard");
  const postCard = document.getElementById("postCard");
  const siteForm = document.getElementById("siteForm");
  const profileForm = document.getElementById("profileForm");
  const profileStatus = document.getElementById("profileStatus");
  const projectList = document.getElementById("projectList");
  const postSelect = document.getElementById("postSelect");
  const postForm = document.getElementById("postForm") || document.getElementById("postCard");
  const postId = document.getElementById("postId");
  const postTitle = document.getElementById("postTitle");
  const postSubtitle = document.getElementById("postSubtitle");
  const postDate = document.getElementById("postDate");
  const postTags = document.getElementById("postTags");
  const postSummary = document.getElementById("postSummary");
  const postReadingTime = document.getElementById("postReadingTime");
  const postContent = document.getElementById("postContent");
  const postStatus = document.getElementById("postStatus");
  let currentPostId = null;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function status(element, text, error = false) {
    element.textContent = text;
    element.style.color = error ? "#a83a24" : "var(--muted)";
  }

  async function apiBase() {
    // 本地直接访问时使用同源 API，隧道离线也能管理内容。
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      return location.origin;
    }
    try {
      const config = await fetch(`data/config.json?t=${Date.now()}`, { cache: "no-store" }).then((res) => res.json());
      return (config.contentApi || "").replace(/\/+$/, "") || location.origin;
    } catch {
      return location.origin;
    }
  }

  async function request(path, options = {}) {
    const base = await apiBase();
    const token = sessionStorage.getItem("modelnotes_admin_token") || "";
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers["X-Admin-Token"] = token;
    const response = await fetch(`${base}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
    return data;
  }

  function fillSite(site) {
    const form = siteForm.elements;
    ["title", "tagline", "type", "theme", "time", "tech", "model", "domain", "repo"].forEach((key) => {
      if (form[key]) form[key].value = site[key] || "";
    });
    if (form.intro) form.intro.value = Array.isArray(site.intro) ? site.intro.join("\n") : site.intro || "";
  }

  function fillProfile(profile) {
    const form = profileForm.elements;
    ["nickname", "role", "email", "location", "avatar", "skills", "bio"].forEach((key) => {
      if (form[key]) form[key].value = profile[key] || "";
    });
  }

  function projectBlock(project, isNew = false) {
    const tags = Array.isArray(project.tags) ? project.tags.join(", ") : project.tags || "";
    const block = document.createElement("div");
    block.className = "admin-project";
    block.dataset.id = project.id || "";
    block.dataset.new = isNew ? "1" : "0";
    block.innerHTML = `
      <div class="admin-grid">
        <label class="admin-field">ID<input data-field="id" value="${esc(project.id || "")}" ${isNew ? "" : "readonly"}></label>
        <label class="admin-field">序号<input data-field="no" value="${esc(project.no || "")}"></label>
        <label class="admin-field">分类<input data-field="category" value="${esc(project.category || "")}"></label>
        <label class="admin-field">状态<input data-field="status" value="${esc(project.status || "")}"></label>
        <label class="admin-field">标题<input data-field="title" value="${esc(project.title || "")}"></label>
        <label class="admin-field">链接<input data-field="link" value="${esc(project.link || "")}"></label>
        <label class="admin-field">链接文字<input data-field="linkLabel" value="${esc(project.linkLabel || "")}"></label>
        <label class="admin-field">标签（逗号分隔）<input data-field="tags" value="${esc(tags)}"></label>
        <label class="admin-field full">摘要<textarea data-field="summary">${esc(project.summary || "")}</textarea></label>
      </div>
      <div class="admin-actions">
        <button class="admin-btn" type="button" data-action="save">保存项目</button>
        <button class="admin-btn danger" type="button" data-action="delete">删除</button>
      </div>`;
    block.querySelector('[data-action="save"]').addEventListener("click", () => saveProject(block));
    block.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProject(block));
    return block;
  }

  function renderProjects(projects) {
    projectList.innerHTML = "";
    projects.forEach((project) => projectList.appendChild(projectBlock(project)));
  }

  async function saveProject(block) {
    const payload = {};
    block.querySelectorAll("[data-field]").forEach((input) => {
      payload[input.dataset.field] = input.value.trim();
    });
    payload.tags = payload.tags ? payload.tags.split(",").map((item) => item.trim()).filter(Boolean) : [];
    if (!payload.id || !payload.title) {
      status(document.getElementById("projectStatus"), "项目需要 ID 与标题。", true);
      return;
    }
    try {
      if (block.dataset.new === "1") {
        await request("/api/admin/projects", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await request(`/api/admin/projects/${encodeURIComponent(block.dataset.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      status(document.getElementById("projectStatus"), "项目已保存。");
      await loadAll();
    } catch (error) {
      status(document.getElementById("projectStatus"), error.message, true);
    }
  }

  async function deleteProject(block) {
    if (!block.dataset.id || !confirm("确定删除这个项目？")) return;
    try {
      await request(`/api/admin/projects/${encodeURIComponent(block.dataset.id)}`, { method: "DELETE" });
      status(document.getElementById("projectStatus"), "项目已删除。");
      await loadAll();
    } catch (error) {
      status(document.getElementById("projectStatus"), error.message, true);
    }
  }

  function fillPostForm(detail) {
    const post = detail.post || detail;
    currentPostId = post.id || null;
    postId.value = post.id || "";
    postTitle.value = post.title || "";
    postSubtitle.value = post.subtitle || "";
    postDate.value = post.date || "";
    postTags.value = Array.isArray(post.tags) ? post.tags.join(", ") : post.tags || "";
    postSummary.value = post.summary || "";
    postReadingTime.value = post.readingTime || "";
    postContent.value = detail.content || "";
  }

  function clearPostForm() {
    currentPostId = null;
    postId.value = "";
    postId.readOnly = false;
    postTitle.value = "";
    postSubtitle.value = "";
    postDate.value = new Date().toISOString().slice(0, 10);
    postTags.value = "";
    postSummary.value = "";
    postReadingTime.value = "";
    postContent.value = "";
    postStatus.textContent = "新文章：填写 ID 与标题后保存。";
  }

  async function loadPost(postIdValue) {
    if (!postIdValue) return;
    try {
      const detail = await request(`/api/posts/${encodeURIComponent(postIdValue)}`);
      fillPostForm(detail);
      postId.readOnly = true;
      status(document.getElementById("postStatus"), "已加载文章。");
    } catch (error) {
      status(document.getElementById("postStatus"), error.message, true);
    }
  }

  async function loadAll() {
    const [site, projects, posts] = await Promise.all([
      request("/api/site"),
      request("/api/projects"),
      request("/api/posts"),
    ]);
    fillSite(site);
    fillProfile(site.profile || {});
    renderProjects(projects.projects || []);
    postSelect.innerHTML = (posts.posts || [])
      .map((post) => `<option value="${esc(post.id)}">${esc(post.title)}</option>`)
      .join("");
    if (posts.posts && posts.posts.length) {
      await loadPost(posts.posts[0].id);
      postSelect.value = posts.posts[0].id;
    } else {
      clearPostForm();
    }
  }

  async function validateToken() {
    const token = tokenInput.value.trim();
    if (!token) {
      status(tokenStatus, "请输入口令。", true);
      return;
    }
    sessionStorage.setItem("modelnotes_admin_token", token);
    try {
      await request("/api/admin/session");
      status(tokenStatus, "口令正确，已解锁。");
      [siteCard, profileCard, projectCard, postCard].forEach((card) => (card.hidden = false));
      await loadAll();
    } catch (error) {
      sessionStorage.removeItem("modelnotes_admin_token");
      status(tokenStatus, error.message, true);
    }
  }

  document.getElementById("saveToken").addEventListener("click", validateToken);
  tokenInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") validateToken();
  });

  siteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = siteForm.elements;
    const payload = {
      title: form.title.value.trim(),
      tagline: form.tagline.value.trim(),
      intro: form.intro.value.split("\n").map((line) => line.trim()).filter(Boolean),
      type: form.type.value.trim(),
      theme: form.theme.value.trim(),
      time: form.time.value.trim(),
      tech: form.tech.value.trim(),
      model: form.model.value.trim(),
      domain: form.domain.value.trim(),
      repo: form.repo.value.trim(),
    };
    try {
      await request("/api/admin/site", { method: "PUT", body: JSON.stringify(payload) });
      status(document.getElementById("siteStatus"), "站点信息已保存。");
    } catch (error) {
      status(document.getElementById("siteStatus"), error.message, true);
    }
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = profileForm.elements;
    const payload = {};
    ["nickname", "role", "email", "location", "avatar", "skills", "bio"].forEach((key) => {
      payload[key] = form[key].value.trim();
    });
    try {
      await request("/api/admin/profile", { method: "PUT", body: JSON.stringify(payload) });
      status(profileStatus, "个人信息已保存。");
    } catch (error) {
      status(profileStatus, error.message, true);
    }
  });

  document.getElementById("addProject").addEventListener("click", () => {
    projectList.prepend(projectBlock({ id: "", no: "", category: "PROJECT", status: "本地演示", title: "", summary: "", tags: [] }, true));
  });

  postSelect.addEventListener("change", () => loadPost(postSelect.value));

  document.getElementById("savePost").addEventListener("click", async () => {
    const payload = {
      id: postId.value.trim(),
      title: postTitle.value.trim(),
      subtitle: postSubtitle.value.trim(),
      date: postDate.value.trim(),
      tags: postTags.value.split(",").map((item) => item.trim()).filter(Boolean),
      summary: postSummary.value.trim(),
      readingTime: postReadingTime.value.trim(),
      content: postContent.value,
    };
    if (!payload.id || !payload.title) {
      status(document.getElementById("postStatus"), "文章需要 ID 与标题。", true);
      return;
    }
    try {
      if (currentPostId) {
        await request(`/api/admin/posts/${encodeURIComponent(currentPostId)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/api/admin/posts", { method: "POST", body: JSON.stringify(payload) });
      }
      status(document.getElementById("postStatus"), "文章已保存。");
      await loadAll();
    } catch (error) {
      status(document.getElementById("postStatus"), error.message, true);
    }
  });

  document.getElementById("newPost").addEventListener("click", clearPostForm);

  document.getElementById("deletePost").addEventListener("click", async () => {
    if (!currentPostId || !confirm("确定删除这篇文章？")) return;
    try {
      await request(`/api/admin/posts/${encodeURIComponent(currentPostId)}`, { method: "DELETE" });
      status(document.getElementById("postStatus"), "文章已删除。");
      await loadAll();
    } catch (error) {
      status(document.getElementById("postStatus"), error.message, true);
    }
  });

  const saved = sessionStorage.getItem("modelnotes_admin_token");
  if (saved) {
    tokenInput.value = saved;
    validateToken();
  }
})();
