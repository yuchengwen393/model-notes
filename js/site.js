(function () {
  const page = document.body.dataset.page;
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menuBtn");

  if (nav) {
    const activeNav = page === "post" ? "posts" : page;
    nav.querySelectorAll("a[data-nav]").forEach((link) => {
      if (link.dataset.nav === activeNav) link.setAttribute("aria-current", "page");
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

  // 站点资料统一从内容 API 读取，同步到侧栏、页脚、标题与个人信息卡。
  function applySiteData() {
    if (!window.BlogAPI) return;
    window.BlogAPI.getSite()
      .then((site) => {
        if (!site) return;

        const title = site.title ? String(site.title).trim() : "";
        if (title) {
          document.querySelectorAll("[data-site-title]").forEach((el) => {
            el.textContent = title;
          });
          // 首页标题是「站点名 · 副标题」，内页标题是「页面名 · 站点名」。
          if (document.title.startsWith("模型手记 · ")) {
            document.title = document.title.replace(/^模型手记/, title);
          } else if (document.title.endsWith("· 模型手记")) {
            document.title = document.title.replace(/· 模型手记$/, `· ${title}`);
          }
        }

        const tagline = site.tagline ? String(site.tagline).trim() : "";
        if (tagline) {
          document.querySelectorAll("[data-site-tagline]").forEach((el) => {
            el.textContent = tagline;
          });
        }

        if (site.repo) {
          document.querySelectorAll("[data-site-repo]").forEach((link) => {
            link.href = site.repo;
          });
        }

        const profile = site.profile || {};
        const card = document.getElementById("sidebarProfile");
        if (card && (profile.nickname || profile.role)) {
          card.hidden = false;
          const name = document.getElementById("sidebarName");
          const role = document.getElementById("sidebarRole");
          const avatar = document.getElementById("sidebarAvatar");
          if (name && profile.nickname) name.textContent = profile.nickname;
          if (role) role.textContent = profile.role || "";
          if (avatar && profile.avatar) {
            avatar.src = profile.avatar;
            avatar.alt = `${profile.nickname || title || "站点"}头像`;
          }
        }
      })
      .catch(() => {
        /* 读取失败时保留 HTML 中的静态标题与资料。 */
      });
  }

  applySiteData();
})();
