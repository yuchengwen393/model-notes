/* 项目页：从内容 API 读取项目，失败时回退到 data/projects.json。 */
(function () {
  const grid = document.getElementById("projectGrid");
  if (!grid) return;

  function card(project) {
    const external = /^https?:\/\//.test(project.link || "");
    const hasLink = Boolean(project.link);
    const tag = hasLink ? "a" : "div";
    const attrs = hasLink
      ? `href="${project.link}"${external ? ' target="_blank" rel="noreferrer"' : ""}`
      : "";
    const link = project.link
      ? `<span class="project-link">${project.linkLabel || "查看项目"}</span>`
      : "";
    return `
      <${tag} class="project-card reveal" ${attrs}>
        <div class="p-top"><span>${project.no || ""} / ${project.category || "PROJECT"}</span><span>${project.status || ""}</span></div>
        <h3>${project.title || ""}</h3>
        <p>${project.summary || ""}</p>
        <div class="project-tags">${(project.tags || []).map((item) => `<span class="tag">${item}</span>`).join("")}</div>
        ${link}
      </${tag}>`;
  }

  window.BlogAPI.getProjects()
    .then((data) => {
      const projects = data.projects || [];
      grid.innerHTML = projects.length
        ? projects.map(card).join("")
        : '<p class="empty-state">还没有项目，去管理页添加一个吧。</p>';
    })
    .catch(() => {
      grid.innerHTML = '<p class="empty-state">项目数据加载失败，请刷新页面重试。</p>';
    });
})();
