(function () {
  const listEl = document.getElementById("postList");
  const countEl = document.getElementById("resultCount");
  const searchEl = document.getElementById("searchInput");
  const tagWrap = document.getElementById("tagFilters");
  if (!listEl) return;

  let posts = [];
  let activeTag = new URLSearchParams(location.search).get("tag") || "全部";
  let query = "";

  function renderTags() {
    const tags = ["全部", ...Array.from(new Set(posts.flatMap((p) => p.tags)))];
    tagWrap.innerHTML = tags
      .map(
        (tag) =>
          `<button class="filter-chip ${tag === activeTag ? "is-active" : ""}" data-tag="${tag}">${tag}</button>`
      )
      .join("");
  }

  function render() {
    const keyword = query.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      const matchTag = activeTag === "全部" || post.tags.includes(activeTag);
      const haystack = [post.title, post.summary, post.subtitle, ...post.tags].join(" ").toLowerCase();
      return matchTag && (!keyword || haystack.includes(keyword));
    });

    countEl.textContent = `${String(filtered.length).padStart(2, "0")} 篇`;
    if (!filtered.length) {
      listEl.innerHTML = '<p class="empty-state">没有匹配的文章，换个关键词试试。</p>';
      return;
    }

    listEl.innerHTML = filtered
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
  }

  window.BlogAPI.getPosts()
    .then((data) => {
      posts = data.posts;
      if (!posts.some((p) => p.tags.includes(activeTag))) activeTag = "全部";
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
