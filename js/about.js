/* 关于页：从内容 API 读取站点信息与个人信息，失败时保留 HTML 中的静态兜底。 */
(function () {
  window.BlogAPI.getSite()
    .then((site) => {
      if (!site) return;

      // 站点简介与主张
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

      // 个人信息卡片：只有填写了昵称、身份或简介时才显示
      const profile = site.profile || {};
      const card = document.getElementById("profileCard");
      if (!card) return;

      const nickname = document.getElementById("profileName");
      const role = document.getElementById("profileRole");
      const bio = document.getElementById("profileBio");
      const meta = document.getElementById("profileMeta");
      const avatar = document.getElementById("profileAvatar");

      if (!profile.nickname && !profile.role && !profile.bio) return;
      card.hidden = false;

      if (profile.nickname) nickname.textContent = profile.nickname;
      role.textContent = profile.role || "";
      role.hidden = !profile.role;
      bio.textContent = profile.bio || "";
      bio.hidden = !profile.bio;

      if (profile.avatar) {
        avatar.src = profile.avatar;
        avatar.alt = `${profile.nickname || "站点"}头像`;
      }

      // 元信息使用 DOM 创建，避免把后台输入当作 HTML 执行
      meta.innerHTML = "";
      function addMeta(text) {
        if (!text) return;
        const item = document.createElement("li");
        item.textContent = text;
        meta.appendChild(item);
      }
      addMeta(profile.location);
      addMeta(profile.skills);

      if (profile.email) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `mailto:${profile.email}`;
        link.textContent = profile.email;
        item.appendChild(link);
        meta.appendChild(item);
      }
    })
    .catch(() => {
      /* 静态 HTML 已有兜底内容，无需额外提示。 */
    });
})();
