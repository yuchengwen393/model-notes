(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) {
    location.replace("posts.html");
    return;
  }

  const titleEl = document.getElementById("articleTitle");
  const subtitleEl = document.getElementById("articleSubtitle");
  const metaEl = document.getElementById("articleMeta");
  const contentEl = document.getElementById("articleContent");
  const eyebrowEl = document.getElementById("articleEyebrow");
  const tagsEl = document.getElementById("articleTags");
  const relatedEl = document.getElementById("relatedPosts");
  const navEl = document.getElementById("postNav");
  const progressEl = document.getElementById("progressBar");

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function tagsOf(post) {
    return Array.isArray(post.tags) ? post.tags : [];
  }

  Promise.all([window.BlogAPI.getPosts(), window.BlogAPI.getPost(id), window.BlogAPI.getSite()])
    .then(([data, detail, site]) => {
      const post = detail.post;
      const content = detail.content;
      const posts = Array.isArray(data.posts) ? data.posts : [];
      const siteTitle = site && site.title ? String(site.title).trim() : "模型手记";
      const index = posts.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("not found");
      const newer = posts[index - 1];
      const older = posts[index + 1];
      const tags = tagsOf(post);
      const date = (post.date || "").replace(/-/g, ".");

      document.title = `${post.title || "文章"} · ${siteTitle}`;
      eyebrowEl.textContent = `${date || "未标注日期"} · ${tags.join(" / ") || "未分类"}`;
      titleEl.textContent = post.title || "未命名文章";
      subtitleEl.textContent = post.subtitle || "";
      metaEl.innerHTML = `
        <span>${esc(post.date || "")}</span>
        <span>·</span>
        <span>${esc(post.readingTime || "")}</span>
        <span>·</span>
        <span>${esc(siteTitle)}</span>`;

      tagsEl.innerHTML = tags
        .map((tag) => `<a class="tag" href="posts.html?tag=${encodeURIComponent(tag)}">${esc(tag)}</a>`)
        .join("");

      const related = posts
        .filter((item) => item.id !== post.id && tagsOf(item).some((tag) => tags.includes(tag)))
        .slice(0, 4);
      relatedEl.innerHTML = related.length
        ? related
            .map((item) => `<a href="post.html?id=${encodeURIComponent(item.id)}">${esc(item.title || "未命名文章")}</a>`)
            .join("")
        : '<span style="font-size:13px;color:var(--muted);">暂无</span>';

      navEl.innerHTML = `
        <div>${newer ? `<small>上一篇（更新）</small><a href="post.html?id=${encodeURIComponent(newer.id)}">← ${esc(newer.title || "未命名文章")}</a>` : ""}</div>
        <div style="text-align:right;">${older ? `<small>下一篇（更早）</small><a href="post.html?id=${encodeURIComponent(older.id)}">${esc(older.title || "未命名文章")} →</a>` : ""}</div>`;

      contentEl.innerHTML = window.renderMarkdown(content);
    })
    .catch(() => {
      titleEl.textContent = "文章未找到";
      subtitleEl.textContent = "";
      contentEl.innerHTML = '<p class="empty-state">这篇文章不存在，或者内容还没有发布。<a href="posts.html" style="color:var(--accent);">返回文章列表</a></p>';
    });

  function updateProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progressEl.style.width = `${Math.min(progress, 100)}%`;
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();
})();
