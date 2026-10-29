(function () {
  const page = document.body.dataset.page;
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menuBtn");

  if (nav) {
    nav.querySelectorAll("a[data-nav]").forEach((link) => {
      if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
    });
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (event) => {
      if (event.target.tagName === "A") {
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // 站点标题从内容 API 读取，同步到页头品牌、页脚名称与浏览器标题。
  function applySiteTitle() {
    if (!window.BlogAPI) return;
    window.BlogAPI.getSite()
      .then((site) => {
        const title = site && site.title ? String(site.title).trim() : "";
        if (!title) return;
        document.querySelectorAll("[data-site-title]").forEach((el) => {
          el.textContent = title;
        });
        if (document.title.includes("模型手记")) {
          document.title = document.title.replaceAll("模型手记", title);
        }
      })
      .catch(() => {
        /* 读取失败时保留 HTML 中的静态标题。 */
      });
  }

  applySiteTitle();
})();
