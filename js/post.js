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

  Promise.all([window.BlogAPI.getPosts(), window.BlogAPI.getPost(id)])
    .then(([data, detail]) => {
      const post = detail.post;
      const content = detail.content;
      const index = data.posts.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("not found");
      const newer = data.posts[index - 1];
      const older = data.posts[index + 1];

      document.title = `${post.title} · 模型手记`;
      eyebrowEl.textContent = `${post.date.replace(/-/g, ".")} · ${post.tags.join(" / ")}`;
      titleEl.textContent = post.title;
      subtitleEl.textContent = post.subtitle;
      metaEl.innerHTML = `
        <span>${post.date}</span>
        <span>·</span>
        <span>${post.readingTime}</span>
        <span>·</span>
        <span>模型手记</span>`;

      tagsEl.innerHTML = post.tags
        .map((tag) => `<a class="tag" href="posts.html?tag=${encodeURIComponent(tag)}">${tag}</a>`)
        .join("");

      const related = data.posts
        .filter((item) => item.id !== post.id && item.tags.some((tag) => post.tags.includes(tag)))
        .slice(0, 4);
      relatedEl.innerHTML = related.length
        ? related
            .map((item) => `<a href="post.html?id=${encodeURIComponent(item.id)}">${item.title}</a>`)
            .join("")
        : '<span style="font-size:13px;color:var(--muted);">暂无</span>';

      navEl.innerHTML = `
        <div>${newer ? `<small>上一篇（更新）</small><a href="post.html?id=${encodeURIComponent(newer.id)}">← ${newer.title}</a>` : ""}</div>
        <div style="text-align:right;">${older ? `<small>下一篇（更早）</small><a href="post.html?id=${encodeURIComponent(older.id)}">${older.title} →</a>` : ""}</div>`;

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
