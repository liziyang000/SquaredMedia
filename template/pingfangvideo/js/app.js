(function () {
  var toggle = document.querySelector(".nav-toggle");
  var drawer = document.querySelector(".mobile-drawer");
  var backdrop = document.querySelector(".mobile-drawer-backdrop");
  var navLinkSelector = ".site-nav a, .mobile-drawer a";
  var desktopNavQuery = window.matchMedia ? window.matchMedia("(min-width: 1021px)") : null;

  function setNavOpen(isOpen, shouldRestoreFocus) {
    if (!toggle || !drawer) return;
    drawer.classList.toggle("is-open", isOpen);
    drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("mobile-nav-open", isOpen);
    if (backdrop) {
      backdrop.hidden = !isOpen;
      backdrop.classList.toggle("is-visible", isOpen);
    }
    if (!isOpen && shouldRestoreFocus) {
      toggle.focus();
    }
  }

  function normalizePath(path) {
    if (!path) return "/";
    return ("".concat(path).replace(/\/+$/, "") || "/").toLowerCase();
  }

  function markCurrentNav() {
    var currentPath = normalizePath(window.location.pathname);
    var links = document.querySelectorAll(navLinkSelector);

    if (!links.length) return;

    var matched = false;
    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href) return;
      var targetPath = "";
      try {
        targetPath = normalizePath(new URL(href, window.location.origin).pathname);
      } catch (error) {
        targetPath = normalizePath(href);
      }
      if (targetPath === currentPath) {
        link.setAttribute("aria-current", "page");
        matched = true;
      } else {
        link.removeAttribute("aria-current");
      }
    });
    if (!matched && links.length) {
      var fallback = links[0];
      if (fallback) {
        fallback.setAttribute("aria-current", "page");
      }
    }
  }

  if (toggle && drawer) {
    if (!toggle.getAttribute("aria-controls")) {
      toggle.setAttribute("aria-controls", "mobileDrawer");
    }
    if (!toggle.hasAttribute("aria-expanded")) {
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var isOpen = !toggle.classList.contains("is-open");
      setNavOpen(isOpen);
      if (isOpen) {
        var firstLink = drawer.querySelector("a, button");
        if (firstLink) firstLink.focus();
      }
    });

    document.querySelectorAll("[data-mobile-nav-close]").forEach(function (control) {
      control.addEventListener("click", function () {
        setNavOpen(false, true);
      });
    });

    drawer.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (link) {
        setNavOpen(false);
      }
    });
  }

  if (toggle && drawer) {
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) {
        setNavOpen(false, true);
      }
    });

    if (desktopNavQuery) {
      desktopNavQuery.addEventListener("change", function (event) {
        if (event.matches) {
          setNavOpen(false);
        }
      });
    }
  }

  markCurrentNav();

  function initSearchForms(root) {
    var scope = root || document;
    scope.querySelectorAll("form").forEach(function (form) {
      if (form.dataset.searchReady === "true" || form.hasAttribute("data-page-jump")) return;

      var input = form.querySelector('input[name="wd"]');
      if (!input) return;

      form.dataset.searchReady = "true";
      form.addEventListener("submit", function (event) {
        if (input.value.trim().length === 0) {
          event.preventDefault();
          input.focus();
        }
      });
    });
  }

  var siteNoticeTimer = null;

  function showSiteNotice(message, status) {
    var notice = document.querySelector("[data-site-notice]");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "site-notice";
      notice.setAttribute("data-site-notice", "");
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      document.body.appendChild(notice);
    }

    notice.textContent = message || "操作成功";
    notice.classList.toggle("is-error", status === "error");
    notice.classList.remove("is-visible");

    window.clearTimeout(siteNoticeTimer);
    window.requestAnimationFrame(function () {
      notice.classList.add("is-visible");
    });
    siteNoticeTimer = window.setTimeout(function () {
      notice.classList.remove("is-visible");
    }, 2400);
  }

  function normalizeHomeUrl(url) {
    var target = (url || "").trim();
    if (target) return target;
    if (window.maccms && window.maccms.path) return window.maccms.path;
    return "/";
  }

  function readCookie(name) {
    var prefix = name + "=";
    var cookies = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < cookies.length; i += 1) {
      var cookie = cookies[i].trim();
      if (cookie.indexOf(prefix) === 0) {
        return decodeURIComponent(cookie.slice(prefix.length));
      }
    }
    return "";
  }

  function queueSiteNotice(message, status) {
    try {
      window.sessionStorage.setItem("pingfang_site_notice", JSON.stringify({
        message: message,
        status: status
      }));
    } catch (error) {
      showSiteNotice(message, status);
    }
  }

  function removeQueuedSiteNotice() {
    try {
      window.sessionStorage.removeItem("pingfang_site_notice");
    } catch (error) {}
  }

  function showQueuedSiteNotice() {
    var raw = "";
    try {
      raw = window.sessionStorage.getItem("pingfang_site_notice");
    } catch (error) {
      return;
    }
    if (!raw) return;

    removeQueuedSiteNotice();
    try {
      var data = JSON.parse(raw);
      showSiteNotice(data.message, data.status);
    } catch (error) {
      removeQueuedSiteNotice();
    }
  }

  function setLoginSubmitting(form, isSubmitting) {
    var button = form.querySelector('[type="submit"]');
    form.dataset.loginSubmitting = isSubmitting ? "true" : "false";
    if (!button) return;
    if (isSubmitting) {
      button.setAttribute("data-label", button.textContent);
      button.textContent = "登录中";
      button.disabled = true;
    } else {
      button.textContent = button.getAttribute("data-label") || "登录";
      button.disabled = false;
    }
  }

  function initLoginForms(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-login-form]").forEach(function (form) {
      if (form.dataset.loginReady === "true") return;
      form.dataset.loginReady = "true";

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (form.dataset.loginSubmitting === "true") return;

        if (!window.fetch || !window.FormData) {
          showSiteNotice("当前浏览器不支持快捷登录，请更换浏览器后重试", "error");
          return;
        }

        setLoginSubmitting(form, true);
        var formData = new FormData(form);
        if (!formData.get("csrf_token")) {
          formData.append("csrf_token", readCookie("pfv_csrf_token"));
        }
        fetch(form.action, {
          method: (form.method || "post").toUpperCase(),
          body: formData,
          credentials: "same-origin",
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        }).then(function (response) {
          return response.json();
        }).then(function (data) {
          var isSuccess = String(data.code) === "1";
          var message = data.msg || (isSuccess ? "登录成功" : "登录失败");

          if (isSuccess) {
            queueSiteNotice(message, "success");
            var redirect = normalizeHomeUrl(form.getAttribute("data-success-redirect"));
            window.location.href = redirect;
            return;
          }

          setLoginSubmitting(form, false);
          showSiteNotice(message, "error");
        }).catch(function () {
          setLoginSubmitting(form, false);
          showSiteNotice("登录请求失败，请稍后重试", "error");
        });
      });
    });
  }

  function logoutRedirect(link) {
    return link.getAttribute("data-logout-redirect") || normalizeHomeUrl("");
  }

  function completeLogout(link) {
    queueSiteNotice("已退出登录", "success");
    window.location.href = logoutRedirect(link);
  }

  function initLogoutLinks(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-logout-link]").forEach(function (link) {
      if (link.dataset.logoutReady === "true") return;
      link.dataset.logoutReady = "true";

      link.addEventListener("click", function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        var logoutUrl = link.getAttribute("href");
        if (!logoutUrl || !window.fetch) {
          window.location.href = logoutUrl || logoutRedirect(link);
          return;
        }

        var formData = new FormData();
        var csrfToken = readCookie("pfv_csrf_token");
        formData.append("csrf_token", csrfToken);

        fetch(logoutUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "X-PingFang-CSRF": csrfToken,
            "Accept": "application/json, text/html;q=0.9, */*;q=0.8"
          }
        }).then(function () {
          completeLogout(link);
        }).catch(function () {
          window.location.href = logoutUrl;
        });
      });
    });
  }

  var favoritePrefix = "pingfang_favorite_";
  var pendingFavoriteButton = null;
  var pendingFavoriteTimer = null;
  var favoriteAjaxReady = false;

  function getFavoriteLabel(button) {
    return button.querySelector("[data-favorite-label]") || button;
  }

  function favoriteKey(button) {
    return favoritePrefix + (button.getAttribute("data-mid") || "0") + "_" + (button.getAttribute("data-type") || "2") + "_" + (button.getAttribute("data-id") || "0");
  }

  function setFavoriteCache(button) {
    try {
      window.localStorage.setItem(favoriteKey(button), "1");
    } catch (error) {}
  }

  function hasFavoriteCache(button) {
    try {
      return window.localStorage.getItem(favoriteKey(button)) === "1";
    } catch (error) {
      return false;
    }
  }

  function setFavoriteButtonState(button, isFavorited) {
    var label = getFavoriteLabel(button);
    var defaultLabel = button.getAttribute("data-favorite-label") || "收藏";
    var savedLabel = button.getAttribute("data-favorite-saved-label") || "已收藏";

    button.classList.toggle("is-favorited", isFavorited);
    button.classList.remove("is-loading");
    button.dataset.favoriteState = isFavorited ? "saved" : "";
    button.dataset.favoriteLoading = "false";
    button.setAttribute("aria-pressed", isFavorited ? "true" : "false");
    label.textContent = isFavorited ? savedLabel : defaultLabel;
  }

  function completeFavorite(button, message) {
    if (!button) return;
    window.clearTimeout(pendingFavoriteTimer);
    pendingFavoriteButton = null;
    setFavoriteCache(button);
    setFavoriteButtonState(button, true);
    showSiteNotice(message || "收藏成功，已加入收藏页", "success");
  }

  function failFavorite(button, message) {
    if (!button) return;
    window.clearTimeout(pendingFavoriteTimer);
    pendingFavoriteButton = null;
    setFavoriteButtonState(button, false);
    showSiteNotice(message || "收藏失败，请稍后重试", "error");
  }

  function parseAjaxResponse(xhr, data) {
    if (data && typeof data === "object") return data;
    if (xhr && xhr.responseJSON) return xhr.responseJSON;
    try {
      return JSON.parse((xhr && xhr.responseText) || data || "{}");
    } catch (error) {
      return {};
    }
  }

  function isFavoriteAjax(settings) {
    var url = settings && settings.url ? String(settings.url) : "";
    return url.indexOf("ajax_ulog") !== -1 && (url.indexOf("type=2") !== -1 || url.indexOf("type%3D2") !== -1);
  }

  function attachFavoriteAjaxFeedback() {
    if (favoriteAjaxReady || !window.jQuery) return;
    favoriteAjaxReady = true;

    window.jQuery(document).ajaxSuccess(function (event, xhr, settings, data) {
      if (!pendingFavoriteButton || !isFavoriteAjax(settings)) return;
      var response = parseAjaxResponse(xhr, data);
      if (String(response.code) === "1") {
        completeFavorite(pendingFavoriteButton, response.msg || "收藏成功，已加入收藏页");
      } else {
        failFavorite(pendingFavoriteButton, response.msg || "收藏失败，请稍后重试");
      }
    });

    window.jQuery(document).ajaxError(function (event, xhr, settings) {
      if (!pendingFavoriteButton || !isFavoriteAjax(settings)) return;
      failFavorite(pendingFavoriteButton, "收藏失败，请稍后重试");
    });
  }

  function clearFavoriteCache() {
    try {
      for (var index = window.localStorage.length - 1; index >= 0; index -= 1) {
        var key = window.localStorage.key(index);
        if (key && key.indexOf(favoritePrefix) === 0) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (error) {}

    document.querySelectorAll("[data-favorite-action]").forEach(function (button) {
      setFavoriteButtonState(button, false);
    });
  }

  function initFavoriteButtons(root) {
    var scope = root || document;
    attachFavoriteAjaxFeedback();

    scope.querySelectorAll("[data-favorite-action]").forEach(function (button) {
      if (button.dataset.favoriteReady === "true") return;
      button.dataset.favoriteReady = "true";
      if (hasFavoriteCache(button)) {
        setFavoriteButtonState(button, true);
      }

      button.addEventListener("click", function (event) {
        if (button.dataset.favoriteState === "saved") {
          event.preventDefault();
          event.stopImmediatePropagation();
          showSiteNotice("已收藏，可在收藏页查看", "success");
          return;
        }

        if (button.dataset.favoriteLoading === "true") {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }

        pendingFavoriteButton = button;
        button.dataset.favoriteLoading = "true";
        button.classList.add("is-loading");
        getFavoriteLabel(button).textContent = "收藏中";
        window.clearTimeout(pendingFavoriteTimer);
        pendingFavoriteTimer = window.setTimeout(function () {
          completeFavorite(button, "收藏成功，已加入收藏页");
        }, 1600);
      });
    });
  }

  var pageJumpFormsReady = false;

  function pageJumpTarget(form, page) {
    var template = form.getAttribute("data-page-template") || "";
    if (template.indexOf("__PAGE__") !== -1) {
      return template.replace(/__PAGE__/g, String(page));
    }

    try {
      var targetUrl = new URL(window.location.href);
      targetUrl.searchParams.set("page", String(page));
      return targetUrl.toString();
    } catch (error) {
      return window.location.href;
    }
  }

  function initPageJumpForms() {
    if (pageJumpFormsReady) return;
    pageJumpFormsReady = true;

    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (form && form.closest && (!form.hasAttribute || !form.hasAttribute("data-page-jump"))) {
        form = form.closest("[data-page-jump]");
      }
      if (!form || !form.hasAttribute || !form.hasAttribute("data-page-jump")) return;

      event.preventDefault();
      var input = form.querySelector(".page-jump-input");
      if (!input) return;

      var max = parseInt(input.getAttribute("max"), 10) || 1;
      var value = parseInt(input.value, 10) || 1;
      var page = Math.min(Math.max(value, 1), max);
      input.value = String(page);

      var target = pageJumpTarget(form, page);
      window.location.href = target;
    });
  }

  function initHomeLatestTabs() {
    var shelf = document.querySelector(".home-shelf-latest");
    if (!shelf) return;

    var tabNav = shelf.querySelector(".home-shelf-tabs");
    if (!tabNav) return;

    var tabControls = Array.prototype.slice.call(tabNav.querySelectorAll("button[data-home-tab]"));
    var panels = Array.prototype.slice.call(shelf.querySelectorAll(".home-shelf-rail[data-home-tab]"));
    if (!tabControls.length || !panels.length) return;

    var valid = {};
    var panelMap = {};
    tabControls.forEach(function (control) {
      var key = control.getAttribute("data-home-tab");
      if (!key) return;
      valid[key] = true;
    });

    if (window.location.hash && window.history && window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }

    panels.forEach(function (panel) {
      var key = panel.getAttribute("data-home-tab");
      if (key) {
        panelMap[key] = panel;
      }
    });

    function getInitialTab() {
      var active = tabNav.querySelector("button[data-home-tab].is-active");
      return active ? active.getAttribute("data-home-tab") : "";
    }

    function applyTab(tabKey) {
      var target = valid[tabKey] ? tabKey : (tabControls[0] ? tabControls[0].getAttribute("data-home-tab") : "");
      if (!target) return;

      tabControls.forEach(function (control) {
        var isActive = control.getAttribute("data-home-tab") === target;
        control.classList.toggle("is-active", isActive);
        control.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      Object.keys(panelMap).forEach(function (key) {
        var panel = panelMap[key];
        var isActive = key === target;
        panel.hidden = !isActive;
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
    }

    applyTab(getInitialTab());

    tabNav.addEventListener("click", function (event) {
      var control = event.target.closest("button[data-home-tab]");
      if (!control || !tabNav.contains(control)) return;
      applyTab(control.getAttribute("data-home-tab") || "");
    });
  }

  var autoNextNavigating = false;

  function normalizePlaybackUrl(value) {
    var raw = String(value || "").trim();
    if (!raw || /javascript:/i.test(raw)) return "";

    try {
      var url = new URL(raw, window.location.href);
      url.hash = "";
      return url.href;
    } catch (error) {
      return "";
    }
  }

  function currentPlaybackUrl() {
    try {
      var currentUrl = new URL(window.location.href);
      currentUrl.hash = "";
      return currentUrl.href;
    } catch (error) {
      return window.location.href.split("#")[0];
    }
  }

  function getNextPlaybackUrl() {
    var holder = document.querySelector("[data-next-play-url]");
    if (!holder) return "";

    var nextUrl = normalizePlaybackUrl(holder.getAttribute("data-next-play-url"));
    if (!nextUrl || nextUrl === currentPlaybackUrl()) return "";
    return nextUrl;
  }

  function syncMacPlayerNextUrl(nextUrl) {
    if (!nextUrl) return;

    if (window.MacPlayer) {
      window.MacPlayer.PlayLinkNext = nextUrl;
    }

    if (window.player_data) {
      window.player_data.link_next = nextUrl;
    }
  }

  function goToNextPlayback() {
    var nextUrl = getNextPlaybackUrl();
    if (!nextUrl || autoNextNavigating) return;

    autoNextNavigating = true;
    if (window.top && window.top !== window) {
      window.top.location.href = nextUrl;
      return;
    }
    window.location.href = nextUrl;
  }

  function bindAutoNextDocument(targetDocument) {
    if (!targetDocument || targetDocument._pingfangAutoNextReady) return;
    targetDocument._pingfangAutoNextReady = true;

    targetDocument.addEventListener("ended", function (event) {
      var media = event.target;
      if (!media || !media.matches || !media.matches("video,audio")) return;
      goToNextPlayback();
    }, true);
  }

  function bindAutoNextFrame(frame) {
    if (!frame || frame.dataset.autoNextReady === "true") return;
    frame.dataset.autoNextReady = "true";

    function bindFrameDocument() {
      try {
        bindAutoNextDocument(frame.contentDocument);
      } catch (error) {}
    }

    frame.addEventListener("load", bindFrameDocument);
    bindFrameDocument();
  }

  function bindAutoNextFrames(root) {
    var scope = root || document;
    scope.querySelectorAll("iframe").forEach(bindAutoNextFrame);
  }

  function initAutoNextPlayback() {
    var nextUrl = getNextPlaybackUrl();
    if (!nextUrl) return;

    syncMacPlayerNextUrl(nextUrl);
    bindAutoNextDocument(document);
    bindAutoNextFrames(document);

    var shell = document.querySelector(".player-shell");
    if (shell && window.MutationObserver && !shell._pingfangAutoNextObserver) {
      shell._pingfangAutoNextObserver = new MutationObserver(function () {
        bindAutoNextFrames(shell);
      });
      shell._pingfangAutoNextObserver.observe(shell, { childList: true, subtree: true });
    }
  }

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initSearchForms = initSearchForms;
  window.PingFangVideo.initLogoutLinks = initLogoutLinks;
  window.PingFangVideo.clearFavoriteCache = clearFavoriteCache;
  window.PingFangVideo.initFavoriteButtons = initFavoriteButtons;
  window.PingFangVideo.initPageJumpForms = initPageJumpForms;
  window.PingFangVideo.initHomeLatestTabs = initHomeLatestTabs;
  window.PingFangVideo.initAutoNextPlayback = initAutoNextPlayback;

  initSearchForms(document);
  showQueuedSiteNotice();
  initLoginForms(document);
  initLogoutLinks(document);
  initFavoriteButtons(document);
  initPageJumpForms();
  initHomeLatestTabs();
  initAutoNextPlayback();

  function initRandomAvatars(root) {
    var colors = ["#ef4444", "#f97316", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];
    var scope = root || document;
    scope.querySelectorAll("[data-avatar-random]").forEach(function (avatar) {
      var index = Math.floor(Math.random() * colors.length);
      var letter = avatar.querySelector(".user-avatar-letter");
      if (letter && letter.textContent.trim().length === 0) {
        var name = (avatar.getAttribute("data-avatar-name") || "").trim();
        letter.textContent = name.slice(0, 1) || "用";
      }
      avatar.style.setProperty("--avatar-bg", colors[index]);
    });
  }

  initRandomAvatars(document);

  var current = window.location.href;
  document.querySelectorAll(".episode-grid a").forEach(function (link) {
    if (link.href === current) {
      link.classList.add("is-active");
    }
  });

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scopedElements(scope, selector) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  var revealBatchSize = 18;
  var revealSelectors = [
    ".page-title",
    ".filter-panel",
    ".content-section",
    ".home-shelf",
    ".detail-grid",
    ".episode-box",
    ".player-shell",
    ".vod-card",
    ".home-shelf-card",
    ".category-tile",
    ".timeline-item",
    ".record-item",
    ".list-item",
    ".module-fallback",
    ".system-box"
  ].join(", ");

  function clearMotionStyles(gsap, targets) {
    if (targets.length === 0) return;
    gsap.killTweensOf(targets);
    gsap.set(targets, { clearProps: "transform,opacity,visibility,willChange,zIndex" });
  }

  function setMotionWillChange(gsap, targets, value) {
    if (!targets.length) return;
    gsap.set(targets, { willChange: value || "auto" });
  }

  function enableGsapCarousel(carousel) {
    carousel.setAttribute("data-gsap-carousel", "true");
  }

  function disableGsapCarousel(carousel) {
    delete carousel.dataset.gsapCarousel;
  }

  function animateHeroSlide(carousel, previousSlide, activeSlide, direction) {
    var gsap = window.gsap;
    if (!gsap || prefersReducedMotion()) {
      disableGsapCarousel(carousel);
      return;
    }

    activeSlide = activeSlide || carousel.querySelector(".hero-slide.is-active");
    if (!activeSlide) return;

    enableGsapCarousel(carousel);

    var slides = scopedElements(carousel, ".hero-slide");
    var copyTargets = scopedElements(activeSlide, ".eyebrow, .banner-copy strong, .banner-copy small, .banner-meta, .banner-actions");
    var poster = activeSlide.querySelector(".banner-poster");
    var contentTargets = copyTargets.slice();
    var offset = direction < 0 ? -18 : 18;

    if (poster) {
      contentTargets.push(poster);
    }
    gsap.killTweensOf(slides.concat(contentTargets));

    slides.forEach(function (slide) {
      if (slide !== previousSlide && slide !== activeSlide) {
        gsap.set(slide, { autoAlpha: 0, x: 0, zIndex: 0 });
      }
    });

    if (previousSlide && previousSlide !== activeSlide) {
      gsap.set(previousSlide, { autoAlpha: 1, x: 0, zIndex: 1 });
      gsap.set(activeSlide, { autoAlpha: 0, x: offset, zIndex: 2 });
      gsap.to(previousSlide, {
        x: -offset,
        autoAlpha: 0,
        duration: 0.3,
        ease: "power2.out",
        overwrite: true,
        clearProps: "transform,opacity,visibility,zIndex"
      });
      gsap.to(activeSlide, {
        x: 0,
        autoAlpha: 1,
        duration: 0.34,
        ease: "power3.out",
        overwrite: true,
        clearProps: "transform,opacity,visibility,zIndex"
      });
    } else {
      gsap.set(activeSlide, { autoAlpha: 1, x: 0, zIndex: 2, clearProps: "transform,opacity,visibility,zIndex" });
      return;
    }

    gsap.fromTo(copyTargets, {
      y: 12
    }, {
      y: 0,
      duration: 0.34,
      ease: "power3.out",
      stagger: 0.025,
      overwrite: "auto",
      clearProps: "transform"
    });

    if (poster) {
      gsap.fromTo(poster, {
        x: offset * 0.55,
        scale: 0.985
      }, {
        x: 0,
        scale: 1,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
        clearProps: "transform"
      });
    }
  }

  function revealDirection(target) {
    if (target.classList.contains("rank-item")) return { x: 12, y: 0 };
    if (target.classList.contains("detail-grid")) return { x: 0, y: 18 };
    if (target.classList.contains("player-shell")) return { x: 0, y: 12 };
    return { x: 0, y: 16 };
  }

  function revealTargets(gsap, targets) {
    var visibleTargets = targets.filter(function (target) {
      return target.getAttribute("data-gsap-revealed") !== "true";
    });
    if (!visibleTargets.length) return;

    function animateBatch() {
      var batch = visibleTargets.splice(0, revealBatchSize);
      if (!batch.length) return;

      batch.forEach(function (target) {
        target.setAttribute("data-gsap-revealed", "true");
      });

      setMotionWillChange(gsap, batch, "transform, opacity");
      gsap.fromTo(batch, {
        x: function (index, target) {
          return revealDirection(target).x;
        },
        y: function (index, target) {
          return revealDirection(target).y;
        },
        autoAlpha: 0
      }, {
        x: 0,
        y: 0,
        autoAlpha: 1,
        duration: 0.36,
        ease: "power3.out",
        stagger: {
          each: 0.035,
          from: "start"
        },
        overwrite: "auto",
        onComplete: function () {
          setMotionWillChange(gsap, batch, "auto");
          animateBatch();
        },
        clearProps: "transform,opacity,visibility,willChange"
      });
    }

    animateBatch();
  }

  function initRevealMotion(scope, gsap) {
    var root = scope || document;
    var targets = scopedElements(root, revealSelectors).filter(function (target) {
      if (target.closest(".hero-carousel")) return false;
      if (target.getAttribute("data-gsap-reveal-ready") === "true") return false;
      target.setAttribute("data-gsap-reveal-ready", "true");
      return true;
    });

    if (!targets.length) return null;

    if (!("IntersectionObserver" in window)) {
      revealTargets(gsap, targets);
      return null;
    }

    var pending = [];
    var scheduled = false;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        pending.push(entry.target);
        observer.unobserve(entry.target);
      });

      if (scheduled || !pending.length) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        revealTargets(gsap, pending.splice(0, pending.length));
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.12
    });

    targets.forEach(function (target) {
      observer.observe(target);
    });

    return function () {
      observer.disconnect();
      pending = [];
    };
  }

  function bindGsapHover(scope, selector, enterVars, leaveVars) {
    var gsap = window.gsap;
    if (!gsap) return;

    scopedElements(scope, selector).forEach(function (item) {
      if (item.dataset.gsapHoverReady === "true") return;
      item.dataset.gsapHoverReady = "true";

      item.addEventListener("mouseenter", function () {
        gsap.to(item, Object.assign({
          duration: 0.18,
          ease: "power2.out",
          overwrite: "auto"
        }, enterVars));
      });

      item.addEventListener("mouseleave", function () {
        gsap.to(item, Object.assign({
          duration: 0.22,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform"
        }, leaveVars));
      });
    });
  }

  function bindGsapPressFeedback(scope, selector) {
    var gsap = window.gsap;
    if (!gsap) return;

    scopedElements(scope, selector).forEach(function (item) {
      if (item.dataset.gsapPressReady === "true") return;
      item.dataset.gsapPressReady = "true";

      item.addEventListener("pointerdown", function () {
        gsap.to(item, {
          scale: 0.985,
          duration: 0.1,
          ease: "power2.out",
          overwrite: "auto"
        });
      });

      item.addEventListener("pointerup", function () {
        gsap.to(item, {
          scale: 1,
          duration: 0.14,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform"
        });
      });

      item.addEventListener("pointerleave", function () {
        gsap.to(item, {
          scale: 1,
          duration: 0.14,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform"
        });
      });
    });
  }

  function initGsapMotion(root) {
    var gsap = window.gsap;
    if (!gsap) return;

    var scope = root && root.querySelectorAll ? root : document;
    var motionRoot = scope === document ? document.documentElement : scope;
    var mm = gsap.matchMedia();

    if (motionRoot._pingfangGsapMotion) {
      motionRoot._pingfangGsapMotion.revert();
    }
    motionRoot._pingfangGsapMotion = mm;

    mm.add({
      reduceMotion: "(prefers-reduced-motion: reduce)",
      canHover: "(hover: hover) and (pointer: fine)"
    }, function (context) {
      var reduceMotion = context.conditions.reduceMotion;
      var canHover = context.conditions.canHover;
      var carousels = scopedElements(scope, "[data-carousel]");
      var entranceTargets = scopedElements(scope, ".hero-carousel .stat-card, .hero-rank .rank-item, .vod-card, .home-shelf-card, " + revealSelectors);
      var revealCleanup = null;

      if (reduceMotion) {
        carousels.forEach(function (carousel) {
          disableGsapCarousel(carousel);
          clearMotionStyles(gsap, scopedElements(carousel, ".hero-slide"));
        });
        clearMotionStyles(gsap, entranceTargets);
        return;
      }

      carousels.forEach(function (carousel) {
        enableGsapCarousel(carousel);
      });

      var timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      var heroTargets = scopedElements(scope, ".hero-slide.is-active .eyebrow, .hero-slide.is-active .banner-copy strong, .hero-slide.is-active .banner-copy small, .hero-slide.is-active .banner-meta, .hero-slide.is-active .banner-actions");
      var posterTargets = scopedElements(scope, ".hero-slide.is-active .banner-poster");
      var statTargets = scopedElements(scope, ".hero-carousel .stat-card");
      var rankTargets = scopedElements(scope, ".hero-rank .rank-item");
      var cards = scopedElements(scope, ".vod-card, .home-shelf-card").slice(0, 12);

      if (heroTargets.length) {
        setMotionWillChange(gsap, heroTargets, "transform, opacity");
        timeline.from(heroTargets, {
          y: 18,
          autoAlpha: 0,
          duration: 0.48,
          stagger: 0.04,
          clearProps: "transform,opacity,visibility,willChange"
        }, 0.03);
      }

      if (posterTargets.length) {
        setMotionWillChange(gsap, posterTargets, "transform, opacity");
        timeline.from(posterTargets, {
          x: 28,
          scale: 0.965,
          autoAlpha: 0,
          duration: 0.56,
          clearProps: "transform,opacity,visibility,willChange"
        }, 0.1);
      }

      if (statTargets.length) {
        setMotionWillChange(gsap, statTargets, "transform, opacity");
        timeline.from(statTargets, {
          y: 14,
          autoAlpha: 0,
          duration: 0.34,
          stagger: 0.04,
          clearProps: "transform,opacity,visibility,willChange"
        }, 0.24);
      }

      if (rankTargets.length) {
        setMotionWillChange(gsap, rankTargets, "transform, opacity");
        timeline.from(rankTargets, {
          x: 12,
          autoAlpha: 0,
          duration: 0.34,
          stagger: 0.03,
          clearProps: "transform,opacity,visibility,willChange"
        }, 0.2);
      }

      if (cards.length) {
        setMotionWillChange(gsap, cards, "transform, opacity");
        timeline.from(cards, {
          y: 16,
          autoAlpha: 0,
          duration: 0.34,
          stagger: 0.02,
          clearProps: "transform,opacity,visibility,willChange"
        }, 0.38);
      }

      revealCleanup = initRevealMotion(scope, gsap);

      if (canHover) {
        bindGsapHover(scope, ".vod-card", { y: -5, scale: 1.012 }, { y: 0, scale: 1 });
        bindGsapHover(scope, ".rank-item", { x: 4 }, { x: 0 });
        bindGsapHover(scope, ".stat-card", { y: -3 }, { y: 0 });
        bindGsapHover(scope, ".category-tile", { y: -4 }, { y: 0 });
        bindGsapHover(scope, ".timeline-card, .favorite-card, .list-item", { y: -3 }, { y: 0 });
        bindGsapHover(scope, ".episode-grid a", { y: -2 }, { y: 0 });
        bindGsapPressFeedback(scope, ".primary-btn, .ghost-btn, .banner-arrow, .page-link, .page-jump-submit");
      }

      return function () {
        if (revealCleanup) revealCleanup();
      };
    });
  }

  function loadCarouselImage(slide) {
    if (!slide || !slide.querySelector) return;
    var image = slide.querySelector("[data-carousel-lazy-src]");
    if (!image) return;
    var source = image.getAttribute("data-carousel-lazy-src");
    if (!source) return;
    image.setAttribute("src", source);
    image.removeAttribute("data-carousel-lazy-src");
  }

  function initHeroCarousel(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-carousel]").forEach(function (carousel) {
      if (carousel.dataset.carouselReady === "true") return;

      var slides = Array.prototype.slice.call(carousel.querySelectorAll("[data-carousel-slide]"));
      var dots = Array.prototype.slice.call(carousel.querySelectorAll("[data-carousel-dot]"));
      var prev = carousel.querySelector("[data-carousel-prev]");
      var next = carousel.querySelector("[data-carousel-next]");
      var index = 0;
      var timer = null;
      var touchStartX = null;
      var touchStartY = null;

      if (slides.length === 0) return;
      carousel.dataset.carouselReady = "true";
      if (window.gsap && !prefersReducedMotion()) {
        enableGsapCarousel(carousel);
      } else {
        disableGsapCarousel(carousel);
      }

      function activate(nextIndex, shouldAnimate) {
        var previousIndex = index;
        var normalizedIndex = (nextIndex + slides.length) % slides.length;
        var previousSlide = slides[previousIndex];
        var activeSlide = slides[normalizedIndex];
        var direction = nextIndex >= previousIndex ? 1 : -1;

        loadCarouselImage(activeSlide);
        index = normalizedIndex;
        slides.forEach(function (slide, itemIndex) {
          var isActive = itemIndex === index;
          slide.classList.toggle("is-active", isActive);
          slide.setAttribute("aria-hidden", isActive ? "false" : "true");
        });
        dots.forEach(function (dot, itemIndex) {
          var isActive = itemIndex === index;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        if (shouldAnimate !== false && previousSlide !== activeSlide) {
          animateHeroSlide(carousel, previousSlide, activeSlide, direction);
        }
      }

      function start() {
        if (slides.length < 2 || timer || document.hidden) return;
        timer = window.setInterval(function () {
          activate(index + 1);
        }, 5200);
      }

      function stop() {
        if (!timer) return;
        window.clearInterval(timer);
        timer = null;
      }

      if (prev) {
        prev.addEventListener("click", function () {
          stop();
          activate(index - 1);
          start();
        });
      }

      if (next) {
        next.addEventListener("click", function () {
          stop();
          activate(index + 1);
          start();
        });
      }

      dots.forEach(function (dot, itemIndex) {
        dot.addEventListener("click", function () {
          stop();
          activate(itemIndex);
          start();
        });
      });

      carousel.addEventListener("mouseenter", stop);
      carousel.addEventListener("mouseleave", start);
      carousel.addEventListener("focusin", stop);
      carousel.addEventListener("focusout", function (event) {
        if (!carousel.contains(event.relatedTarget)) {
          start();
        }
      });
      carousel.addEventListener("touchstart", function (event) {
        var touch = event.touches && event.touches[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        stop();
      }, { passive: true });
      carousel.addEventListener("touchend", function (event) {
        var touch = event.changedTouches && event.changedTouches[0];
        if (touch && touchStartX !== null && touchStartY !== null) {
          var deltaX = touch.clientX - touchStartX;
          var deltaY = touch.clientY - touchStartY;
          if (Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
            activate(deltaX < 0 ? index + 1 : index - 1);
          }
        }
        touchStartX = null;
        touchStartY = null;
        start();
      }, { passive: true });
      carousel.addEventListener("touchcancel", function () {
        touchStartX = null;
        touchStartY = null;
        start();
      }, { passive: true });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          stop();
        } else {
          start();
        }
      });
      activate(0, false);
      start();
    });
  }

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initHeroCarousel = initHeroCarousel;
  window.PingFangVideo.initGsapMotion = initGsapMotion;
  initHeroCarousel(document);
  initGsapMotion(document);

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var timeline = document.querySelector(".history-timeline[data-history-source]");
  if (timeline) {
    try {
      var raw = localStorage.getItem("pingfang_history") || localStorage.getItem("mac_history") || "[]";
      var records = JSON.parse(raw);
      var fallbackHistoryUrl = window.maccms && window.maccms.path ? window.maccms.path : "/";
      if (Array.isArray(records) && records.length > 0) {
        timeline.innerHTML = records.map(function (record) {
          var date = (record.date || record.time || "").slice(0, 10) || "最近";
          var clock = (record.date || record.time || "").slice(11, 16) || "--:--";
          var name = record.name || record.title || "观看记录";
          var url = record.url || fallbackHistoryUrl;
          var pic = record.pic || record.image || "";
          var progress = record.progress || record.episode || "继续观看";
          return '<div class="timeline-date">' + escapeHtml(date) + '</div><article class="timeline-item"><span class="timeline-dot"></span><div class="timeline-time">' + escapeHtml(clock) + '</div><a class="timeline-card" href="' + escapeHtml(url) + '">' + (pic ? '<img src="' + escapeHtml(pic) + '" alt="' + escapeHtml(name) + '">' : '') + '<span><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(progress) + '</small><em>点击继续播放</em></span></a></article>';
        }).join("");
      }
    } catch (error) {
      timeline.classList.add("history-unavailable");
    }
  }
})();
