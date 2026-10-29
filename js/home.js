(function () {
  const container = document.getElementById("latestPosts");
  if (!container) return;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  window.BlogAPI.getPosts()
    .then((data) => {
      const posts = Array.isArray(data.posts) ? data.posts : [];
      document.querySelectorAll('[data-stat="posts"]').forEach((el) => {
        el.textContent = posts.length;
      });

      const latest = posts.slice(0, 3);
      container.innerHTML = latest.length
        ? latest
            .map((post, index) => {
              const tags = Array.isArray(post.tags) ? post.tags : [];
              const date = (post.date || "").replace(/-/g, ".");
              return `
          <a class="post-item" href="post.html?id=${encodeURIComponent(post.id)}">
            <span class="post-no">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>${esc(post.title || "未命名文章")}</h3>
              <p>${esc(post.summary || "")}</p>
            </div>
            <div class="post-meta">
              <span>${esc(date)}</span>
              <span class="tag">${esc(tags[0] || "未分类")}</span>
              <span>${esc(post.readingTime || "")}</span>
            </div>
          </a>`;
            })
            .join("")
        : '<p class="empty-state">还没有文章，去管理页发布一篇吧。</p>';
    })
    .catch(() => {
      container.innerHTML = '<p class="empty-state">文章数据加载失败，请刷新页面重试。</p>';
    });
})();
