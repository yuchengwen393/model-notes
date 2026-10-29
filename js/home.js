(function () {
  const container = document.getElementById("latestPosts");
  if (!container) return;

  window.BlogAPI.getPosts()
    .then((data) => {
      const posts = data.posts.slice(0, 3);
      container.innerHTML = posts
        .map(
          (post, index) => `
          <a class="post-item" href="post.html?id=${encodeURIComponent(post.id)}">
            <span class="post-no">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>${post.title}</h3>
              <p>${post.summary}</p>
            </div>
            <div class="post-meta">
              <span>${post.date.replace(/-/g, ".")}</span>
              <span class="tag">${post.tags[0]}</span>
              <span>${post.readingTime}</span>
            </div>
          </a>`
        )
        .join("");
    })
    .catch(() => {
      container.innerHTML = '<p class="empty-state">文章数据加载失败，请刷新页面重试。</p>';
    });
})();
