/* 关于页：从内容 API 读取站点信息，失败时保留 HTML 中的静态兜底。 */
(function () {
  window.BlogAPI.getSite()
    .then((site) => {
      if (!site) return;
      const intro = document.getElementById("aboutIntro");
      if (intro && Array.isArray(site.intro) && site.intro.length) {
        intro.innerHTML = site.intro.map((text) => `<p>${text}</p>`).join("");
      }
      document.querySelectorAll("[data-site]").forEach((element) => {
        const value = site[element.dataset.site];
        if (value) element.textContent = value;
      });
      const tagline = document.getElementById("aboutTagline");
      if (tagline && site.tagline) tagline.textContent = site.tagline;
    })
    .catch(() => {
      /* 静态 HTML 已有兜底内容，无需额外提示。 */
    });
})();
