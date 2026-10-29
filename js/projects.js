/* 项目卡片：项目页与首页共用，数据来自内容 API。 */
(function () {
  const grids = ["projectGrid", "homeProjects"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!grids.length) return;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function safeLink(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value.trim(), location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function card(project, index) {
    const link = safeLink(project.link);
    const tag = link ? "a" : "div";
    const sameOrigin = link && new URL(link).origin === location.origin;
    const attrs = link
      ? `href="${esc(link)}"${sameOrigin ? "" : ' target="_blank" rel="noreferrer"'}`
      : "";
    const tags = Array.isArray(project.tags) ? project.tags : [];
    const number = project.no || String(index + 1).padStart(2, "0");
    const linkLabel = link ? `<span class="project-link">${esc(project.linkLabel || "查看项目")}</span>` : "";
    return `
      <${tag} class="project-card" ${attrs}>
        <div class="p-top"><span>${esc(number)} / ${esc(project.category || "PROJECT")}</span><span>${esc(project.status || "")}</span></div>
        <h3>${esc(project.title || "未命名项目")}</h3>
        <p>${esc(project.summary || "")}</p>
        <div class="project-tags">${tags.map((item) => `<span class="tag">${esc(item)}</span>`).join("")}</div>
        ${linkLabel}
      </${tag}>`;
  }

  window.BlogAPI.getProjects()
    .then((data) => {
      const projects = Array.isArray(data.projects) ? data.projects : [];
      grids.forEach((grid) => {
        const limit = Number(grid.dataset.limit || projects.length);
        const list = projects.slice(0, Number.isFinite(limit) && limit > 0 ? limit : projects.length);
        grid.innerHTML = list.length
          ? list.map(card).join("")
          : '<p class="empty-state">还没有项目，去管理页添加一个吧。</p>';
      });
      const count = document.getElementById("projectCount");
      if (count) count.textContent = projects.length;
    })
    .catch(() => {
      grids.forEach((grid) => {
        grid.innerHTML = '<p class="empty-state">项目数据加载失败，请刷新页面重试。</p>';
      });
    });
})();
