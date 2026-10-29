/* 内容 API 客户端：优先读 Node.js 后端，失败时回退到静态 JSON / Markdown。 */
(function () {
  const CONFIG_URL = "data/config.json";
  let configPromise = null;

  function loadConfig() {
    if (!configPromise) {
      configPromise = fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({}));
    }
    return configPromise;
  }

  async function apiBase() {
    // 本地直接访问时使用同源 API，避免隧道离线导致本地后台不可用。
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      return location.origin;
    }
    const config = await loadConfig();
    return (config.contentApi || "").replace(/\/+$/, "");
  }

  async function apiGet(path) {
    const base = await apiBase();
    if (!base) throw new Error("content api not configured");
    const res = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`content api ${res.status}`);
    return res.json();
  }

  async function getPosts() {
    try {
      const data = await apiGet("/api/posts");
      if (Array.isArray(data.posts) && data.posts.length) return data;
    } catch (error) {
      console.warn("[blog-api] posts fallback:", error.message);
    }
    const res = await fetch("data/posts.json", { cache: "no-store" });
    if (!res.ok) throw new Error("posts.json missing");
    return res.json();
  }

  async function getPost(id) {
    try {
      const data = await apiGet(`/api/posts/${encodeURIComponent(id)}`);
      if (data.post && typeof data.content === "string") return data;
    } catch (error) {
      console.warn("[blog-api] post fallback:", error.message);
    }
    const data = await fetch("data/posts.json", { cache: "no-store" }).then((res) => res.json());
    const post = data.posts.find((item) => item.id === id);
    if (!post) throw new Error("post not found");
    const res = await fetch(`posts/${post.id}.md`, { cache: "no-store" });
    if (!res.ok) throw new Error("markdown missing");
    return { post, content: await res.text() };
  }

  async function getProjects() {
    try {
      const data = await apiGet("/api/projects");
      if (Array.isArray(data.projects) && data.projects.length) return data;
    } catch (error) {
      console.warn("[blog-api] projects fallback:", error.message);
    }
    const res = await fetch("data/projects.json", { cache: "no-store" });
    if (!res.ok) throw new Error("projects.json missing");
    return res.json();
  }

  async function getSite() {
    try {
      const data = await apiGet("/api/site");
      if (data && data.title) return data;
    } catch (error) {
      console.warn("[blog-api] site fallback:", error.message);
    }
    const res = await fetch("data/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error("site.json missing");
    return res.json();
  }

  window.BlogAPI = { loadConfig, getPosts, getPost, getProjects, getSite };
})();
