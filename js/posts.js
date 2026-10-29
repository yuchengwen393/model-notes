(function () {
  const listEl = document.getElementById("postList");
  const countEl = document.getElementById("resultCount");
  const searchEl = document.getElementById("searchInput");
  const tagWrap = document.getElementById("tagFilters");
  const headingCount = document.getElementById("postsHeadingCount");
  if (!listEl) return;

  let posts = [];
  let activeTag = new URLSearchParams(location.search).get("tag") || "全部";
  let query = "";

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

  function renderTags() {
    const tags = ["全部", ...Array.from(new Set(posts.flatMap(tagsOf)))];
    tagWrap.innerHTML = tags
      .map(
        (tag) =>
          `<button class="filter-chip ${tag === activeTag ? "is-active" : ""}" data-tag="${esc(tag)}">${esc(tag)}</button>`
      )
      .join("");
  }

  function render() {
    const keyword = query.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      const tags = tagsOf(post);
      const matchTag = activeTag === "全部" || tags.includes(activeTag);
      const haystack = [post.title, post.summary, post.subtitle, ...tags].join(" ").toLowerCase();
      return matchTag && (!keyword || haystack.includes(keyword));
    });

    countEl.textContent = `${String(filtered.length).padStart(2, "0")} 篇`;
    if (!filtered.length) {
      listEl.innerHTML = '<p class="empty-state">没有匹配的文章，换个关键词试试。</p>';
      return;
    }

    listEl.innerHTML = filtered
      .map((post, index) => {
        const tags = tagsOf(post);
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
      .join("");
  }

  window.BlogAPI.getPosts()
    .then((data) => {
      posts = Array.isArray(data.posts) ? data.posts : [];
      if (headingCount) headingCount.textContent = posts.length;
      if (!posts.some((post) => tagsOf(post).includes(activeTag))) activeTag = "全部";
      renderTags();
      render();
    })
    .catch(() => {
      listEl.innerHTML = '<p class="empty-state">文章数据加载失败，请刷新页面重试。</p>';
    });

  tagWrap.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tag]");
    if (!btn) return;
    activeTag = btn.dataset.tag;
    renderTags();
    render();
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render();
  });
})();
