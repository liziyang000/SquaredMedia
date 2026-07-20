(function () {
  var toggle = document.querySelector(".nav-toggle");
  var drawer = document.querySelector(".mobile-drawer");
  var backdrop = document.querySelector(".mobile-drawer-backdrop");
  var siteHeader = document.querySelector(".site-header");
  var navLinkSelector = ".site-nav a[data-nav-section], .mobile-drawer-links a[data-nav-section]";
  var desktopNavQuery = window.matchMedia ? window.matchMedia("(min-width: 1181px)") : null;
  var mobileHeaderQuery = window.matchMedia ? window.matchMedia("(max-width: 760px)") : null;
  var compactHeaderEnterY = 132;
  var compactHeaderExitY = 48;
  var themeStorageKey = "pingfang_theme";
  var validThemes = {
    "blue-pink-purple": true,
    "poster-magazine": true
  };
  var themeSwitcherDocumentReady = false;
  var themeTransitionTimer = null;
  var backdropHideTimer = null;
  var drawerMotionTimer = null;
  var pageInertState = [];

  function setPageInert(isInert) {
    if (isInert) {
      if (pageInertState.length > 0) return;
      pageInertState = Array.prototype.slice.call(document.body.children).filter(function (element) {
        return element !== drawer && element !== backdrop && element.tagName !== "SCRIPT" && element.tagName !== "STYLE";
      }).map(function (element) {
        var state = { element: element, wasInert: element.inert };
        element.inert = true;
        return state;
      });
      return;
    }

    pageInertState.forEach(function (state) {
      state.element.inert = state.wasInert;
    });
    pageInertState = [];
  }

  function drawerFocusableElements() {
    if (!drawer) return [];
    return Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (element) {
      return !element.hidden && element.getAttribute("aria-hidden") !== "true";
    });
  }

  function trapDrawerFocus(event) {
    if (!drawer || event.key !== "Tab" || !drawer.classList.contains("is-open")) return;
    var focusable = drawerFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      drawer.focus();
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearBackdropHideTimer() {
    if (!backdropHideTimer) return;
    window.clearTimeout(backdropHideTimer);
    backdropHideTimer = null;
  }

  function finishBackdropClose(event) {
    if (!backdrop || (event && (event.target !== backdrop || event.propertyName !== "opacity"))) return;
    if (backdrop.classList.contains("is-visible")) return;
    clearBackdropHideTimer();
    backdrop.hidden = true;
  }

  function finishDrawerMotion(event) {
    if (!drawer || (event && (event.target !== drawer || event.propertyName !== "transform"))) return;
    if (drawerMotionTimer) {
      window.clearTimeout(drawerMotionTimer);
      drawerMotionTimer = null;
    }
    drawer.classList.remove("is-animating");
  }

  function scheduleDrawerMotion() {
    if (!drawer) return;
    if (drawerMotionTimer) {
      window.clearTimeout(drawerMotionTimer);
    }
    drawer.classList.add("is-animating");
    if (prefersReducedMotion()) {
      finishDrawerMotion();
      return;
    }
    drawerMotionTimer = window.setTimeout(finishDrawerMotion, 280);
  }

  function setNavOpen(isOpen, shouldRestoreFocus) {
    if (!toggle || !drawer) return;
    var wasOpen = drawer.classList.contains("is-open");
    if (wasOpen !== isOpen) {
      scheduleDrawerMotion();
      setPageInert(isOpen);
    }
    drawer.classList.toggle("is-open", isOpen);
    drawer.inert = !isOpen;
    drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    document.body.classList.toggle("mobile-nav-open", isOpen);
    if (backdrop) {
      clearBackdropHideTimer();
      if (isOpen) {
        backdrop.hidden = false;
        void backdrop.offsetWidth;
        backdrop.classList.add("is-visible");
      } else {
        backdrop.classList.remove("is-visible");
        if (backdrop.hidden || prefersReducedMotion()) {
          finishBackdropClose();
        } else {
          backdropHideTimer = window.setTimeout(finishBackdropClose, 260);
        }
      }
    }
    if (!isOpen && shouldRestoreFocus) {
      toggle.focus();
    }
  }

  function syncCompactMobileHeader() {
    if (!siteHeader || !mobileHeaderQuery) return;
    if (!mobileHeaderQuery.matches) {
      siteHeader.classList.remove("is-compact");
      return;
    }
    if (siteHeader.classList.contains("is-compact")) {
      if (window.scrollY < compactHeaderExitY) {
        siteHeader.classList.remove("is-compact");
      }
    } else if (window.scrollY > compactHeaderEnterY) {
      siteHeader.classList.add("is-compact");
    }
  }

  if (siteHeader && mobileHeaderQuery) {
    window.addEventListener("scroll", syncCompactMobileHeader, { passive: true });
    mobileHeaderQuery.addEventListener("change", syncCompactMobileHeader);
    syncCompactMobileHeader();
  }

  function normalizePath(path) {
    if (!path) return "/";
    return ("".concat(path).replace(/\/+$/, "") || "/").toLowerCase();
  }

  function currentNavSection() {
    var currentPath = normalizePath(window.location.pathname);

    try {
      var currentUrl = new URL(window.location.href);
      var route = String(currentUrl.searchParams.get("route") || "").toLowerCase();
      if (route === "home") return "home";
      if ({ categories: true, category: true, videos: true, search: true, detail: true, play: true, player: true, history: true, down: true, copyright: true, report: true }[route]) {
        return "videos";
      }
      if (route) return "";

      var moduleName = String(currentUrl.searchParams.get("m") || "").toLowerCase();
      var actionName = String(currentUrl.searchParams.get("ac") || "").toLowerCase();
      if (moduleName.indexOf("vod") !== -1 || actionName.indexOf("vod") !== -1) {
        return "videos";
      }
    } catch (error) {}

    if (currentPath.indexOf("/vod") !== -1 || /\/label\/(categories|videos|hot|history)(?:\/|$)/.test(currentPath)) {
      return "videos";
    }

    var homeLink = document.querySelector('.site-nav a[data-nav-section="home"], .mobile-drawer-links a[data-nav-section="home"]');
    if (homeLink) {
      try {
        if (normalizePath(new URL(homeLink.href, window.location.origin).pathname) === currentPath) {
          return "home";
        }
      } catch (error) {}
    }

    return currentPath === "/" || /\/index(?:\.php|\.html)?$/.test(currentPath) ? "home" : "";
  }

  function markCurrentNav() {
    var links = document.querySelectorAll(navLinkSelector);
    var section = currentNavSection();

    if (!links.length) return;

    links.forEach(function (link) {
      if (section && link.getAttribute("data-nav-section") === section) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function normalizeTheme(theme) {
    theme = String(theme || "").trim();
    return validThemes[theme] ? theme : "";
  }

  function themeFromOption(option) {
    var value = option.getAttribute("data-theme-option");
    if (value === "default") return "";
    return normalizeTheme(value);
  }

  function getStoredTheme() {
    try {
      return normalizeTheme(window.localStorage.getItem(themeStorageKey));
    } catch (error) {
      return "";
    }
  }

  function syncThemeControls(theme) {
    document.querySelectorAll("[data-theme-option]").forEach(function (option) {
      var isActive = themeFromOption(option) === theme;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function clearThemeTransition() {
    if (themeTransitionTimer) {
      window.clearTimeout(themeTransitionTimer);
      themeTransitionTimer = null;
    }
    document.documentElement.classList.remove("theme-transitioning");
  }

  function scheduleThemeTransition() {
    clearThemeTransition();
    document.documentElement.offsetWidth;
    document.documentElement.classList.add("theme-transitioning");
    themeTransitionTimer = window.setTimeout(clearThemeTransition, 560);
  }

  function applyTheme(theme, shouldPersist) {
    theme = normalizeTheme(theme);
    if (shouldPersist) {
      scheduleThemeTransition();
    }

    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    if (shouldPersist) {
      try {
        if (theme) {
          window.localStorage.setItem(themeStorageKey, theme);
        } else {
          window.localStorage.removeItem(themeStorageKey);
        }
      } catch (error) {}
    }

    syncThemeControls(theme);
  }

  function setThemeSwitcherOpen(switcher, isOpen, shouldRestoreFocus) {
    var trigger = switcher.querySelector("[data-theme-switcher-trigger]");
    var menu = switcher.querySelector("[data-theme-switcher-menu]");
    if (!trigger || !menu) return;

    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    menu.hidden = !isOpen;
    switcher.classList.toggle("is-open", isOpen);
    if (!isOpen && shouldRestoreFocus) {
      trigger.focus();
    }
  }

  function closeThemeSwitchers() {
    document.querySelectorAll("[data-theme-switcher]").forEach(function (switcher) {
      setThemeSwitcherOpen(switcher, false);
    });
  }

  function initThemeSwitchers(root) {
    var scope = root || document;
    applyTheme(getStoredTheme(), false);

    scope.querySelectorAll("[data-theme-switcher]").forEach(function (switcher) {
      if (switcher.dataset.themeSwitcherReady === "true") return;
      switcher.dataset.themeSwitcherReady = "true";

      var trigger = switcher.querySelector("[data-theme-switcher-trigger]");
      if (trigger) {
        trigger.addEventListener("click", function () {
          var isOpen = trigger.getAttribute("aria-expanded") !== "true";
          closeThemeSwitchers();
          setThemeSwitcherOpen(switcher, isOpen);
        });
      }
    });

    scope.querySelectorAll("[data-theme-option]").forEach(function (option) {
      if (option.dataset.themeOptionReady === "true") return;
      option.dataset.themeOptionReady = "true";

      option.addEventListener("click", function () {
        applyTheme(themeFromOption(option), true);
        var switcher = option.closest("[data-theme-switcher]");
        if (switcher) {
          setThemeSwitcherOpen(switcher, false, true);
        } else {
          closeThemeSwitchers();
        }
      });
    });

    if (!themeSwitcherDocumentReady) {
      themeSwitcherDocumentReady = true;
      document.addEventListener("click", function (event) {
        if (!event.target.closest("[data-theme-switcher]")) {
          closeThemeSwitchers();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          var switcher = document.querySelector("[data-theme-switcher].is-open");
          if (switcher) {
            event.preventDefault();
            setThemeSwitcherOpen(switcher, false, true);
          }
        }
      });
    }
  }

  if (toggle && drawer) {
    if (!toggle.getAttribute("aria-controls")) {
      toggle.setAttribute("aria-controls", "mobileDrawer");
    }
    if (!toggle.hasAttribute("aria-expanded")) {
      toggle.setAttribute("aria-expanded", "false");
    }
    drawer.addEventListener("transitionend", finishDrawerMotion);
    if (backdrop) {
      backdrop.addEventListener("transitionend", finishBackdropClose);
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
      trapDrawerFocus(event);
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
      input.addEventListener("input", function () {
        input.setCustomValidity("");
        input.removeAttribute("aria-invalid");
      });
      form.addEventListener("submit", function (event) {
        if (input.value.trim().length === 0) {
          event.preventDefault();
          input.setCustomValidity("请输入搜索内容");
          input.setAttribute("aria-invalid", "true");
          input.focus();
          input.reportValidity();
        } else {
          input.setCustomValidity("");
          input.removeAttribute("aria-invalid");
          if (form.closest(".mobile-drawer")) {
            setNavOpen(false);
          }
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
        fetch(form.action, {
          method: (form.method || "post").toUpperCase(),
          body: new FormData(form),
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

  function initLoginControls(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      if (button.dataset.loginControlReady === "true") return;
      var input = document.getElementById(button.getAttribute("aria-controls") || "");
      if (!input) return;
      button.dataset.loginControlReady = "true";

      button.addEventListener("click", function () {
        var shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.setAttribute("aria-pressed", shouldShow ? "true" : "false");
        button.setAttribute("aria-label", shouldShow ? "隐藏密码" : "显示密码");
        input.focus({ preventScroll: true });
      });
    });

    scope.querySelectorAll("[data-verify-refresh]").forEach(function (button) {
      if (button.dataset.loginControlReady === "true") return;
      button.dataset.loginControlReady = "true";

      button.addEventListener("click", function () {
        var field = button.closest(".login-field");
        var image = field && field.querySelector(".mac_verify_img");
        var preview = field && field.querySelector(".login-captcha-preview");

        if (image) {
          try {
            var url = new URL(image.src, window.location.href);
            url.searchParams.set("_", String(Date.now()));
            image.src = url.toString();
          } catch (error) {
            image.src = image.src;
          }
        }

        if (preview) {
          var codes = ["6B8Y", "K4M9", "P7X2", "R5N8"];
          var currentIndex = codes.indexOf(preview.textContent.trim());
          preview.textContent = codes[(currentIndex + 1) % codes.length];
        }
      });
    });
  }

  function initLoginGlass(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-login-glass]").forEach(function (panel) {
      if (panel.dataset.loginGlassReady === "true") return;
      panel.dataset.loginGlassReady = "true";

      var page = panel.closest(".login-page");
      var setMotionState = function (isRunning) {
        var state = isRunning ? "running" : "paused";
        panel.dataset.loginMotion = state;
        if (page) page.dataset.loginMotion = state;
      };

      if ("IntersectionObserver" in window) {
        var observer = new IntersectionObserver(function (entries) {
          setMotionState(Boolean(entries[0] && entries[0].isIntersecting));
          if (!panel.isConnected) observer.disconnect();
        }, { threshold: 0.08 });
        observer.observe(panel);
      }

      var highlight = panel.querySelector(".login-glass-highlight");
      var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!highlight || !finePointer || reduceMotion) return;

      var pointerFrame = 0;
      var pointerPosition = null;
      var highlightSize = highlight.offsetWidth || 340;
      var renderHighlight = function () {
        pointerFrame = 0;
        if (!pointerPosition || !panel.isConnected) return;
        var bounds = panel.getBoundingClientRect();
        var x = pointerPosition.x - bounds.left - panel.clientLeft - (highlightSize / 2);
        var y = pointerPosition.y - bounds.top - panel.clientTop - (highlightSize / 2);
        highlight.style.transform = "translate3d(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px, 0)";
      };
      var requestHighlightRender = function () {
        if (!pointerPosition || pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(renderHighlight);
      };
      var trackPointer = function (event) {
        if (!panel.isConnected || (event.pointerType && event.pointerType !== "mouse")) return;
        pointerPosition = { x: event.clientX, y: event.clientY };
        panel.dataset.loginPointer = "active";
        requestHighlightRender();
      };
      var hideHighlight = function () {
        delete panel.dataset.loginPointer;
      };

      window.addEventListener("pointermove", trackPointer, { passive: true });
      window.addEventListener("scroll", requestHighlightRender, { passive: true });
      window.addEventListener("resize", requestHighlightRender);
      window.addEventListener("blur", hideHighlight);
      document.documentElement.addEventListener("pointerleave", hideHighlight);
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
          showSiteNotice("当前浏览器不支持安全退出，请更换浏览器后重试", "error");
          return;
        }

        fetch(logoutUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json"
          }
        }).then(function (response) {
          return response.json();
        }).then(function (data) {
          if (data && String(data.code) === "1") {
            completeLogout(link);
            return;
          }
          showSiteNotice((data && data.msg) || "退出失败，请稍后重试", "error");
        }).catch(function () {
          showSiteNotice("退出请求失败，请稍后重试", "error");
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
        getFavoriteLabel(button).textContent = "收藏中…";
        window.clearTimeout(pendingFavoriteTimer);
        pendingFavoriteTimer = window.setTimeout(function () {
          failFavorite(button, "收藏请求超时，请稍后重试");
        }, 10000);
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

  function initHomeEmptyStates(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-home-empty-container], [data-empty-container]").forEach(function (container) {
      var itemSelector = container.getAttribute("data-empty-item");
      var emptyState = container.querySelector("[data-home-empty-state], [data-empty-state]");
      if (!itemSelector || !emptyState) return;

      var isEmpty = !container.querySelector(itemSelector);
      emptyState.hidden = !isEmpty;
      container.classList.toggle("is-empty", isEmpty);
    });
  }

  function syncActiveSelectionSemantics(root) {
    var scope = root || document;
    scope.querySelectorAll(".filter-options a").forEach(function (link) {
      if (link.classList.contains("is-active")) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
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

    initHomeEmptyStates(shelf);

    var valid = {};
    var panelMap = {};
    var controlMap = {};

    panels.forEach(function (panel) {
      var key = panel.getAttribute("data-home-tab");
      if (key) {
        panelMap[key] = panel;
      }
    });

    tabControls = tabControls.filter(function (control, tabIndex) {
      var key = control.getAttribute("data-home-tab");
      var panel = key ? panelMap[key] : null;
      var keepEmptyPanel = tabIndex === 0 || key === "all";
      var isAvailable = Boolean(panel && (keepEmptyPanel || panel.querySelector(".home-shelf-card")));
      control.hidden = !isAvailable;
      if (!isAvailable) {
        if (panel) {
          panel.hidden = true;
          panel.setAttribute("aria-hidden", "true");
        }
        return false;
      }

      control.id = control.id || "latest-tab-" + tabIndex;
      valid[key] = true;
      controlMap[key] = control;
      panel.setAttribute("aria-labelledby", control.id);
      return true;
    });
    if (!tabControls.length) return;

    function tabFromUrl() {
      try {
        return new URL(window.location.href).searchParams.get("latest") || "";
      } catch (error) {
        return "";
      }
    }

    function getInitialTab() {
      var requested = tabFromUrl();
      if (valid[requested]) return requested;
      var active = tabNav.querySelector("button[data-home-tab].is-active");
      return active ? active.getAttribute("data-home-tab") : "";
    }

    function updateTabUrl(target, replace) {
      if (!window.history || !window.history.pushState) return;
      try {
        var nextUrl = new URL(window.location.href);
        var defaultKey = tabControls[0].getAttribute("data-home-tab") || "all";
        if (target === defaultKey) {
          nextUrl.searchParams.delete("latest");
        } else {
          nextUrl.searchParams.set("latest", target);
        }
        var nextLocation = nextUrl.pathname + nextUrl.search + nextUrl.hash;
        window.history[replace ? "replaceState" : "pushState"]({}, "", nextLocation);
      } catch (error) {}
    }

    function applyTab(tabKey, writeUrl, replaceUrl) {
      var target = valid[tabKey] ? tabKey : (tabControls[0] ? tabControls[0].getAttribute("data-home-tab") : "");
      if (!target) return;

      tabControls.forEach(function (control) {
        var isActive = control.getAttribute("data-home-tab") === target;
        control.classList.toggle("is-active", isActive);
        control.setAttribute("aria-selected", isActive ? "true" : "false");
        control.tabIndex = isActive ? 0 : -1;
      });

      Object.keys(panelMap).forEach(function (key) {
        var panel = panelMap[key];
        var isActive = key === target;
        panel.hidden = !isActive;
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
      if (writeUrl) updateTabUrl(target, replaceUrl);
    }

    shelf._pingfangApplyHomeTab = function (tabKey) {
      applyTab(tabKey || tabFromUrl(), false, true);
    };
    applyTab(getInitialTab(), Boolean(tabFromUrl() && !valid[tabFromUrl()]), true);

    tabNav.addEventListener("click", function (event) {
      var control = event.target.closest("button[data-home-tab]");
      if (!control || !tabNav.contains(control)) return;
      applyTab(control.getAttribute("data-home-tab") || "", true, false);
    });

    tabNav.addEventListener("keydown", function (event) {
      var control = event.target.closest("button[data-home-tab]");
      if (!control || !tabNav.contains(control)) return;

      var currentIndex = tabControls.indexOf(control);
      var nextIndex = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % tabControls.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + tabControls.length) % tabControls.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabControls.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      var nextControl = tabControls[nextIndex];
      applyTab(nextControl.getAttribute("data-home-tab") || "", true, true);
      nextControl.focus();
    });

    if (!window._pingfangHomeTabPopstateReady) {
      window._pingfangHomeTabPopstateReady = true;
      window.addEventListener("popstate", function () {
        var currentShelf = document.querySelector(".home-shelf-latest");
        if (currentShelf && typeof currentShelf._pingfangApplyHomeTab === "function") {
          currentShelf._pingfangApplyHomeTab();
        }
      });
    }
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

  function dynamicFilterRequestUrl(panel) {
    var endpoint = panel.getAttribute("data-filter-endpoint");
    if (!endpoint || !window.URL) return "";

    try {
      var url = new URL(endpoint, window.location.origin);
      var params = {
        type_id: panel.getAttribute("data-filter-type-id") || "",
        area: panel.getAttribute("data-current-area") || "",
        year: panel.getAttribute("data-current-year") || "",
        lang: panel.getAttribute("data-current-lang") || "",
        class: panel.getAttribute("data-current-class") || "",
        letter: panel.getAttribute("data-current-letter") || "",
        limit: "80"
      };
      Object.keys(params).forEach(function (key) {
        if (params[key] !== "") {
          url.searchParams.set(key, params[key]);
        }
      });
      return url.toString();
    } catch (error) {
      return "";
    }
  }

  function normalizeFilterOptions(list) {
    var values = {};
    if (!Array.isArray(list)) return values;

    list.forEach(function (item) {
      var value = typeof item === "string" ? item : item && item.value;
      value = String(value || "").trim();
      if (value) {
        values[value] = true;
      }
    });
    return values;
  }

  function applyDynamicVodFilters(panel, filters) {
    if (!filters || typeof filters !== "object") return;

    panel.querySelectorAll("[data-filter-kind]").forEach(function (row) {
      var kind = row.getAttribute("data-filter-kind");
      var values = normalizeFilterOptions(filters[kind]);
      if (!Object.keys(values).length) return;

      row.querySelectorAll("[data-filter-value]").forEach(function (link) {
        var value = String(link.getAttribute("data-filter-value") || "").trim();
        var isActive = link.classList.contains("is-active") || link.getAttribute("aria-current") === "page";
        var isAvailable = !!values[value];
        link.hidden = !isAvailable && !isActive;
        link.classList.toggle("is-unavailable", !isAvailable && !isActive);
      });
    });
  }

  function initDynamicVodFilters(root) {
    if (!window.fetch) return;
    var scope = root || document;
    scope.querySelectorAll("[data-dynamic-vod-filters]").forEach(function (panel) {
      if (panel.dataset.pingfangFilterReady === "true") return;
      panel.dataset.pingfangFilterReady = "true";

      var requestUrl = dynamicFilterRequestUrl(panel);
      if (!requestUrl) return;

      fetch(requestUrl, {
        credentials: "same-origin",
        headers: {
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        }
      }).then(function (response) {
        if (!response.ok) return null;
        return response.json();
      }).then(function (data) {
        if (!data || String(data.code) !== "1") return;
        var payload = data.data || {};
        applyDynamicVodFilters(panel, payload.filters || {});
      }).catch(function () {});
    });
  }

  function safeContinueResource(value, allowImageData) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (allowImageData && /^data:image\//i.test(raw)) return raw;

    try {
      var url = new URL(raw, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function normalizeContinueRecord(record) {
    if (!record || typeof record !== "object") return null;
    var data = record.data && typeof record.data === "object" ? record.data : {};
    var name = String(data.name || record.name || record.title || "").trim();
    var url = safeContinueResource(data.link || record.link || record.url, false);
    if (!name || !url) return null;

    var episode = record.ulog_nid || record.episode || "";
    var source = record.ulog_sid || record.source || "";
    var progress = String(record.progress || "").trim();
    if (!progress && episode) {
      progress = (source ? "第 " + source + " 组 · " : "") + "第 " + episode + " 集";
    }

    return {
      id: String(data.id || record.ulog_rid || record.id || "").trim(),
      name: name,
      url: url,
      pic: safeContinueResource(data.pic || record.pic || record.image, true),
      progress: progress || "继续观看"
    };
  }

  function uniqueContinueRecords(records) {
    var seen = {};
    return records.map(normalizeContinueRecord).filter(function (record) {
      if (!record) return false;
      var key = record.id || record.url || record.name;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 4);
  }

  function localContinueRecords() {
    var records = [];
    ["pingfang_history", "mac_history"].forEach(function (key) {
      try {
        var parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) {
          records = records.concat(parsed);
        } else if (parsed && Array.isArray(parsed.list)) {
          records = records.concat(parsed.list);
        }
      } catch (error) {}
    });
    return records;
  }

  function renderHomeContinueRecords(section, records) {
    var list = section.querySelector("[data-home-continue-list]");
    if (!list) return;

    var normalized = uniqueContinueRecords(records);
    if (!normalized.length) {
      list.innerHTML = "";
      section.hidden = true;
      return;
    }

    list.innerHTML = normalized.map(function (record) {
      var poster = record.pic
        ? '<span class="home-continue-poster"><img src="' + escapeHtml(record.pic) + '" alt="' + escapeHtml(record.name) + '" width="96" height="144" loading="lazy" decoding="async" sizes="72px"></span>'
        : '<span class="home-continue-poster is-image-missing" aria-hidden="true"></span>';
      return '<a class="home-continue-card" href="' + escapeHtml(record.url) + '" aria-label="继续观看 ' + escapeHtml(record.name) + '">' + poster + '<span class="home-continue-body"><strong>' + escapeHtml(record.name) + '</strong><small>' + escapeHtml(record.progress) + '</small><em>继续观看</em></span></a>';
    }).join("");
    section.hidden = false;
    initMediaFallbacks(section);
  }

  function initHomeContinueWatching(root) {
    var scope = root || document;
    var section = scope.matches && scope.matches("[data-home-continue]") ? scope : scope.querySelector("[data-home-continue]");
    if (!section || section.dataset.homeContinueReady === "true") return;
    section.dataset.homeContinueReady = "true";

    var localRecords = localContinueRecords();
    renderHomeContinueRecords(section, localRecords);

    if (!window.MAC || !window.MAC.Ulog || typeof window.MAC.Ulog.Get !== "function") return;
    try {
      window.MAC.Ulog.Get(4, 1, 12, function (response) {
        if (!response || String(response.code) !== "1") return;
        var remoteRecords = Array.isArray(response.list)
          ? response.list
          : (response.data && Array.isArray(response.data.list) ? response.data.list : []);
        if (remoteRecords.length) {
          renderHomeContinueRecords(section, remoteRecords.concat(localRecords));
        }
      });
    } catch (error) {}
  }

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.markCurrentNav = markCurrentNav;
  window.PingFangVideo.initSearchForms = initSearchForms;
  window.PingFangVideo.initLogoutLinks = initLogoutLinks;
  window.PingFangVideo.clearFavoriteCache = clearFavoriteCache;
  window.PingFangVideo.initFavoriteButtons = initFavoriteButtons;
  window.PingFangVideo.initPageJumpForms = initPageJumpForms;
  window.PingFangVideo.initHomeEmptyStates = initHomeEmptyStates;
  window.PingFangVideo.syncActiveSelectionSemantics = syncActiveSelectionSemantics;
  window.PingFangVideo.initHomeLatestTabs = initHomeLatestTabs;
  window.PingFangVideo.initHomeContinueWatching = initHomeContinueWatching;
  window.PingFangVideo.initAutoNextPlayback = initAutoNextPlayback;
  window.PingFangVideo.initDynamicVodFilters = initDynamicVodFilters;
  window.PingFangVideo.initThemeSwitchers = initThemeSwitchers;
  window.PingFangVideo.initLoginControls = initLoginControls;
  window.PingFangVideo.initLoginGlass = initLoginGlass;

  initThemeSwitchers(document);
  initSearchForms(document);
  showQueuedSiteNotice();
  initLoginForms(document);
  initLoginControls(document);
  initLoginGlass(document);
  initLogoutLinks(document);
  initFavoriteButtons(document);
  initPageJumpForms();
  initHomeEmptyStates(document);
  syncActiveSelectionSemantics(document);
  initHomeLatestTabs();
  initHomeContinueWatching(document);
  initAutoNextPlayback();
  initDynamicVodFilters(document);

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

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function clearMotionStyles(gsap, targets) {
    if (targets.length === 0) return;
    gsap.killTweensOf(targets);
    gsap.set(targets, { clearProps: "transform,opacity,visibility,willChange,zIndex" });
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
        clearProps: "transform,opacity,visibility,zIndex",
        onComplete: function () {
          clearMotionStyles(gsap, slides);
        }
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

  function clearBannerIridescence(gsap, carousels) {
    if (!carousels.length) return;

    gsap.killTweensOf(carousels);
    carousels.forEach(function (carousel) {
      carousel.removeAttribute("data-banner-iridescence");
      carousel.style.removeProperty("--banner-shine-x");
      carousel.style.removeProperty("--banner-shine-y");
      carousel.style.removeProperty("--banner-shine-rotate");
      carousel.style.removeProperty("--banner-shine-opacity");
    });
  }

  function initBannerIridescence(scope, gsap, coarsePointer) {
    var carousels = scopedElements(scope, ".hero-carousel[data-carousel]");
    if (!carousels.length) return null;

    var cleanups = [];

    carousels.forEach(function (carousel) {
      var supportsIntersectionObserver = "IntersectionObserver" in window;
      var autoplay = gsap.timeline({
        repeat: -1,
        yoyo: true,
        paused: supportsIntersectionObserver,
        defaults: { ease: "sine.inOut" }
      });
      var iridescenceObserver = null;
      var isInViewport = !supportsIntersectionObserver;
      var orientationApi = window.DeviceOrientationEvent;
      var orientationListening = false;
      var permissionRequested = false;
      var sensorFrame = null;
      var currentX = 50;
      var currentY = 44;
      var currentRotate = 0;
      var targetX = currentX;
      var targetY = currentY;
      var targetRotate = currentRotate;

      carousel.setAttribute("data-banner-iridescence", "true");
      gsap.set(carousel, {
        "--banner-shine-x": "50%",
        "--banner-shine-y": "44%",
        "--banner-shine-rotate": "0deg",
        "--banner-shine-opacity": 0.58
      });

      autoplay
        .to(carousel, {
          "--banner-shine-x": "72%",
          "--banner-shine-y": "36%",
          "--banner-shine-rotate": "42deg",
          duration: 3.8
        })
        .to(carousel, {
          "--banner-shine-x": "34%",
          "--banner-shine-y": "58%",
          "--banner-shine-rotate": "-26deg",
          duration: 4.2
        });

      function syncBannerAutoplay() {
        var shouldPlay = isInViewport && !document.hidden;
        carousel.toggleAttribute("data-banner-iridescence-paused", !shouldPlay);
        if (!autoplay) return;
        if (shouldPlay) {
          autoplay.resume();
        } else {
          autoplay.pause();
        }
      }

      if (supportsIntersectionObserver) {
        iridescenceObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.target !== carousel) return;
            isInViewport = entry.isIntersecting;
            syncBannerAutoplay();
          });
        }, { threshold: 0.01 });
        iridescenceObserver.observe(carousel);
      }
      document.addEventListener("visibilitychange", syncBannerAutoplay);
      syncBannerAutoplay();

      function applySensorFrame() {
        currentX += (targetX - currentX) * 0.18;
        currentY += (targetY - currentY) * 0.18;
        currentRotate += (targetRotate - currentRotate) * 0.18;

        carousel.style.setProperty("--banner-shine-x", currentX.toFixed(2) + "%");
        carousel.style.setProperty("--banner-shine-y", currentY.toFixed(2) + "%");
        carousel.style.setProperty("--banner-shine-rotate", currentRotate.toFixed(2) + "deg");
        carousel.style.setProperty("--banner-shine-opacity", "0.62");

        if (Math.abs(targetX - currentX) > 0.02 || Math.abs(targetY - currentY) > 0.02 || Math.abs(targetRotate - currentRotate) > 0.02) {
          sensorFrame = window.requestAnimationFrame(applySensorFrame);
        } else {
          sensorFrame = null;
        }
      }

      function scheduleSensorFrame() {
        if (sensorFrame) return;
        sensorFrame = window.requestAnimationFrame(applySensorFrame);
      }

      function handleOrientation(event) {
        if (!isInViewport || document.hidden) return;
        if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;

        if (autoplay) {
          autoplay.kill();
          autoplay = null;
        }

        targetX = clampNumber(50 + event.gamma * 0.72, 22, 78);
        targetY = clampNumber(44 + event.beta * 0.34, 22, 74);
        targetRotate = clampNumber(event.gamma * 0.45, -22, 22);
        scheduleSensorFrame();
      }

      function startDeviceOrientation() {
        if (orientationListening || !orientationApi || window.isSecureContext === false) return;
        orientationListening = true;
        window.addEventListener("deviceorientation", handleOrientation);
      }

      function requestDeviceOrientation() {
        if (!orientationApi || typeof orientationApi.requestPermission !== "function" || permissionRequested) return;

        permissionRequested = true;
        orientationApi.requestPermission().then(function (permission) {
          if (permission === "granted") {
            startDeviceOrientation();
          } else {
            permissionRequested = false;
          }
        }).catch(function () {
          permissionRequested = false;
        });
      }

      if (coarsePointer && orientationApi && window.isSecureContext !== false) {
        if (typeof orientationApi.requestPermission === "function") {
          carousel.addEventListener("pointerdown", requestDeviceOrientation, { passive: true });
          carousel.addEventListener("touchstart", requestDeviceOrientation, { passive: true });
        } else {
          startDeviceOrientation();
        }
      }

      cleanups.push(function () {
        if (autoplay) autoplay.kill();
        if (iridescenceObserver) iridescenceObserver.disconnect();
        if (sensorFrame) window.cancelAnimationFrame(sensorFrame);
        if (orientationListening) window.removeEventListener("deviceorientation", handleOrientation);
        document.removeEventListener("visibilitychange", syncBannerAutoplay);
        carousel.removeEventListener("pointerdown", requestDeviceOrientation);
        carousel.removeEventListener("touchstart", requestDeviceOrientation);
        carousel.removeAttribute("data-banner-iridescence");
        carousel.removeAttribute("data-banner-iridescence-paused");
        carousel.style.removeProperty("--banner-shine-x");
        carousel.style.removeProperty("--banner-shine-y");
        carousel.style.removeProperty("--banner-shine-rotate");
        carousel.style.removeProperty("--banner-shine-opacity");
      });
    });

    return function () {
      cleanups.forEach(function (cleanup) {
        cleanup();
      });
    };
  }

  function initLiquidLens(scope, gsap) {
    var carousels = scopedElements(scope, ".hero-carousel[data-carousel]");
    var cleanups = [];

    carousels.forEach(function (carousel) {
      var lens = carousel.querySelector(".liquid-lens");
      if (!lens) return;

      var bounds = carousel.getBoundingClientRect();
      var lensMotionTimer = null;
      var xTo = gsap.quickTo(lens, "x", { duration: 0.72, ease: "power3.out" });
      var yTo = gsap.quickTo(lens, "y", { duration: 0.72, ease: "power3.out" });
      var opacityTo = gsap.quickTo(lens, "opacity", { duration: 0.42, ease: "power2.out" });

      function startLensMotion() {
        if (lensMotionTimer) {
          window.clearTimeout(lensMotionTimer);
          lensMotionTimer = null;
        }
        lens.style.willChange = "transform, opacity";
      }

      function finishLensMotion() {
        lensMotionTimer = null;
        lens.style.removeProperty("will-change");
      }

      function scheduleLensMotionEnd() {
        if (lensMotionTimer) {
          window.clearTimeout(lensMotionTimer);
        }
        lensMotionTimer = window.setTimeout(finishLensMotion, 760);
      }

      function refreshBounds() {
        bounds = carousel.getBoundingClientRect();
      }

      function moveLens(event) {
        startLensMotion();
        xTo(clampNumber(event.clientX - bounds.left, 0, bounds.width));
        yTo(clampNumber(event.clientY - bounds.top, 0, bounds.height));
        opacityTo(0.72);
        scheduleLensMotionEnd();
      }

      function settleLens() {
        startLensMotion();
        xTo(bounds.width * 0.72);
        yTo(bounds.height * 0.34);
        opacityTo(0.46);
        scheduleLensMotionEnd();
      }

      gsap.set(lens, {
        xPercent: -50,
        yPercent: -50,
        x: bounds.width * 0.72,
        y: bounds.height * 0.34,
        opacity: 0.46
      });
      carousel.addEventListener("pointerenter", refreshBounds, { passive: true });
      carousel.addEventListener("pointermove", moveLens, { passive: true });
      carousel.addEventListener("pointerleave", settleLens, { passive: true });
      window.addEventListener("resize", refreshBounds, { passive: true });

      cleanups.push(function () {
        carousel.removeEventListener("pointerenter", refreshBounds);
        carousel.removeEventListener("pointermove", moveLens);
        carousel.removeEventListener("pointerleave", settleLens);
        window.removeEventListener("resize", refreshBounds);
        if (lensMotionTimer) window.clearTimeout(lensMotionTimer);
        gsap.killTweensOf(lens);
        gsap.set(lens, { clearProps: "transform,opacity,visibility,willChange" });
      });
    });

    return function () {
      cleanups.forEach(function (cleanup) {
        cleanup();
      });
    };
  }

  function initPageEntrance(scope, gsap) {
    var header = scope === document ? document.querySelector(".header-inner") : null;
    var carousel = (scope || document).querySelector(".hero-carousel");
    var heroCopy = carousel ? scopedElements(carousel, ".hero-slide.is-active .eyebrow, .hero-slide.is-active .banner-copy strong, .hero-slide.is-active .banner-meta, .hero-slide.is-active .banner-copy small, .hero-slide.is-active .banner-actions") : [];
    var rankItems = scopedElements(scope, ".hero-rank .rank-item");
    var timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

    timeline.addLabel("cinema-open", 0);
    if (header) {
      timeline.from(header, {
        autoAlpha: 0,
        y: -14,
        duration: 0.46,
        willChange: "transform,opacity",
        clearProps: "transform,opacity,visibility,willChange"
      }, "cinema-open");
    }
    if (carousel) {
      timeline.from(carousel, {
        autoAlpha: 0,
        y: 22,
        scale: 0.988,
        duration: 0.78,
        transformOrigin: "50% 60%",
        willChange: "transform,opacity",
        clearProps: "transform,opacity,visibility,willChange"
      }, "cinema-open+=0.08");
    }
    if (heroCopy.length) {
      timeline.from(heroCopy, {
        autoAlpha: 0,
        y: 18,
        duration: 0.56,
        stagger: 0.055,
        willChange: "transform,opacity",
        clearProps: "transform,opacity,visibility,willChange"
      }, "cinema-open+=0.3");
    }
    if (rankItems.length) {
      timeline.from(rankItems, {
        autoAlpha: 0,
        y: 16,
        duration: 0.48,
        stagger: 0.045,
        willChange: "transform,opacity",
        clearProps: "transform,opacity,visibility,willChange"
      }, "cinema-open+=0.5");
    }

    return function () {
      timeline.kill();
    };
  }

  function initSectionMotion(scope, gsap) {
    var sections = scopedElements(scope, ".genre-dock, .home-shelf, .page-title, .filter-panel, .content-section, .category-index, .history-timeline, .system-page, .detail-grid, .player-page");
    if (!sections.length) return null;

    if (!("IntersectionObserver" in window)) {
      return null;
    }

    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var animatedSections = sections.filter(function (section) {
      return section.getBoundingClientRect().top >= viewportHeight * 0.82;
    });
    if (!animatedSections.length) return null;

    gsap.set(animatedSections, { y: 16 });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        gsap.set(entry.target, { willChange: "transform" });
        gsap.to(entry.target, {
          y: 0,
          duration: 0.36,
          ease: "power3.out",
          overwrite: "auto",
          clearProps: "transform,willChange"
        });
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.08
    });

    animatedSections.forEach(function (section) {
      observer.observe(section);
    });

    return function () {
      observer.disconnect();
      gsap.killTweensOf(animatedSections);
      gsap.set(animatedSections, { clearProps: "transform,willChange" });
    };
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
      coarsePointer: "(hover: none) and (pointer: coarse)",
      finePointer: "(hover: hover) and (pointer: fine)"
    }, function (context) {
      var reduceMotion = context.conditions.reduceMotion;
      var coarsePointer = context.conditions.coarsePointer;
      var finePointer = context.conditions.finePointer;
      var carousels = scopedElements(scope, "[data-carousel]");
      var iridescenceCleanup = null;
      var entranceCleanup = null;
      var sectionCleanup = null;
      var lensCleanup = null;

      if (reduceMotion) {
        carousels.forEach(function (carousel) {
          disableGsapCarousel(carousel);
          clearMotionStyles(gsap, scopedElements(carousel, ".hero-slide"));
        });
        clearBannerIridescence(gsap, carousels);
        clearMotionStyles(gsap, scopedElements(scope, ".genre-dock, .home-shelf, .page-title, .filter-panel, .content-section, .category-index, .history-timeline, .system-page, .detail-grid, .player-page"));
        return;
      }

      carousels.forEach(function (carousel) {
        enableGsapCarousel(carousel);
      });
      iridescenceCleanup = initBannerIridescence(scope, gsap, coarsePointer);
      entranceCleanup = initPageEntrance(scope, gsap);
      sectionCleanup = initSectionMotion(scope, gsap);
      if (finePointer) {
        lensCleanup = initLiquidLens(scope, gsap);
      }

      return function () {
        if (iridescenceCleanup) iridescenceCleanup();
        if (entranceCleanup) entranceCleanup();
        if (sectionCleanup) sectionCleanup();
        if (lensCleanup) lensCleanup();
      };
    });
  }

  var homeGsapLoadPromise = null;
  var homeMotionMedia = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 761px)")
    : null;
  var homeMotionMediaReady = false;
  var homeMotionScope = document;

  function homeMotionAllowed() {
    return !prefersReducedMotion() && Boolean(homeMotionMedia && homeMotionMedia.matches);
  }

  function clearHomeMotion(scope) {
    var motionRoot = scope === document ? document.documentElement : scope;
    if (motionRoot && motionRoot._pingfangGsapMotion) {
      motionRoot._pingfangGsapMotion.revert();
      delete motionRoot._pingfangGsapMotion;
    }
    scopedElements(scope, "[data-carousel]").forEach(disableGsapCarousel);
  }

  function initHomeMotion(root) {
    var scope = root && root.querySelectorAll ? root : document;
    homeMotionScope = scope;
    var sourceElement = scope.matches && scope.matches("[data-home-gsap-src]")
      ? scope
      : scope.querySelector("[data-home-gsap-src]");
    if (!sourceElement) {
      clearHomeMotion(scope);
      return Promise.resolve(false);
    }

    if (!homeMotionMediaReady && homeMotionMedia) {
      homeMotionMediaReady = true;
      var handleMotionMediaChange = function () { initHomeMotion(homeMotionScope); };
      if (typeof homeMotionMedia.addEventListener === "function") {
        homeMotionMedia.addEventListener("change", handleMotionMediaChange);
      } else if (typeof homeMotionMedia.addListener === "function") {
        homeMotionMedia.addListener(handleMotionMediaChange);
      }
    }

    if (!homeMotionAllowed()) {
      clearHomeMotion(scope);
      return Promise.resolve(false);
    }
    if (window.gsap) {
      initGsapMotion(scope);
      return Promise.resolve(true);
    }

    var source = sourceElement.getAttribute("data-home-gsap-src");
    if (!source) return Promise.resolve(false);
    if (!homeGsapLoadPromise) {
      homeGsapLoadPromise = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = source;
        script.async = true;
        script.dataset.homeGsap = "true";
        script.addEventListener("load", function () { resolve(Boolean(window.gsap)); }, { once: true });
        script.addEventListener("error", reject, { once: true });
        document.head.appendChild(script);
      }).catch(function () {
        homeGsapLoadPromise = null;
        return false;
      });
    }

    return homeGsapLoadPromise.then(function (loaded) {
      if (loaded && sourceElement.isConnected && homeMotionAllowed()) {
        initGsapMotion(scope);
      }
      return loaded;
    });
  }

  var carouselSequence = 0;

  function ensureCarouselDots(carousel, slides) {
    var dotsWrap = carousel.querySelector(".banner-dots");
    if (!dotsWrap || dotsWrap.querySelector("[data-carousel-dot]")) return;
    carouselSequence += 1;
    var carouselId = carousel.id || "heroCarousel" + carouselSequence;
    carousel.id = carouselId;

    slides.forEach(function (slide, itemIndex) {
      var slideId = carouselId + "-slide-" + (itemIndex + 1);
      var dotId = carouselId + "-tab-" + (itemIndex + 1);
      var dot = document.createElement("button");
      dot.className = "banner-dot" + (itemIndex === 0 ? " is-active" : "");
      dot.id = dotId;
      dot.type = "button";
      dot.setAttribute("data-carousel-dot", "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "第" + (itemIndex + 1) + "张");
      dot.setAttribute("aria-controls", slideId);
      dot.setAttribute("aria-selected", itemIndex === 0 ? "true" : "false");
      dot.tabIndex = itemIndex === 0 ? 0 : -1;
      slide.id = slideId;
      slide.setAttribute("role", "tabpanel");
      slide.setAttribute("aria-labelledby", dotId);
      slide.setAttribute("aria-hidden", itemIndex === 0 ? "false" : "true");
      slide.inert = itemIndex !== 0;
      dotsWrap.appendChild(dot);
    });
  }

  function markMissingImage(image) {
    if (!image || image.dataset.mediaFallbackState === "missing") return;
    image.dataset.mediaFallbackState = "missing";
    image.hidden = true;
    if (image.parentElement) {
      image.parentElement.classList.add("is-image-missing");
    }
  }

  function initMediaFallbacks(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var images = scopedElements(scope, ".rank-thumb img, .home-shelf-poster img, .poster img, .detail-poster img, .detail-backdrop img, .list-item > img");

    images.forEach(function (image) {
      if (image.dataset.mediaFallbackReady === "true") return;
      image.dataset.mediaFallbackReady = "true";
      image.addEventListener("error", function () {
        markMissingImage(image);
      }, { once: true });
      if (image.complete && image.naturalWidth === 0) {
        markMissingImage(image);
      }
    });
  }

  function ensureHeroSlideBackground(slide, priority) {
    if (!slide || slide.dataset.bannerBgReady) return;

    var backdrop = slide.getAttribute("data-banner-bg");
    if (!backdrop) {
      slide.dataset.bannerBgReady = "missing";
      slide.classList.add("has-missing-background");
      return;
    }

    var image = new window.Image();
    slide.dataset.bannerBgReady = "loading";
    image.fetchPriority = priority === "high" ? "high" : "low";
    image.onload = function () {
      var applyBackground = function () {
        if (!slide.isConnected) return;
        slide.style.setProperty("--banner-bg", "url(" + JSON.stringify(backdrop) + ")");
        slide.dataset.bannerBgReady = "true";
        slide.classList.remove("has-missing-background");
      };
      if (typeof image.decode === "function") {
        image.decode().catch(function () {}).then(applyBackground);
        return;
      }
      applyBackground();
    };
    image.onerror = function () {
      if (!slide.isConnected) return;
      slide.style.removeProperty("--banner-bg");
      slide.dataset.bannerBgReady = "missing";
      slide.classList.add("has-missing-background");
    };
    image.src = backdrop;
  }

  function scheduleHeroBackgroundPreload(slide) {
    if (!slide || slide.dataset.bannerBgReady || slide.dataset.bannerBgScheduled) return;
    slide.dataset.bannerBgScheduled = "true";
    var preload = function () {
      delete slide.dataset.bannerBgScheduled;
      ensureHeroSlideBackground(slide, "low");
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(preload, { timeout: 1200 });
    } else {
      window.setTimeout(preload, 240);
    }
  }

  function initHeroCarousel(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-carousel]").forEach(function (carousel) {
      if (carousel.dataset.carouselReady === "true") return;

      var slides = Array.prototype.slice.call(carousel.querySelectorAll("[data-carousel-slide]"));
      if (slides.length === 0) return;

      ensureCarouselDots(carousel, slides);

      var dots = Array.prototype.slice.call(carousel.querySelectorAll("[data-carousel-dot]"));
      var prev = carousel.querySelector("[data-carousel-prev]");
      var next = carousel.querySelector("[data-carousel-next]");
      var autoplayToggle = carousel.querySelector("[data-carousel-autoplay-toggle]");
      var index = 0;
      var timer = null;
      var carouselHasFocus = false;
      var carouselInViewport = !("IntersectionObserver" in window);
      var carouselAutoplayObserver = null;
      var userPaused = prefersReducedMotion();
      var touchStartX = null;
      var touchStartY = null;

      carousel.dataset.carouselReady = "true";
      ensureHeroSlideBackground(slides[0], "high");
      if (slides.length > 1) scheduleHeroBackgroundPreload(slides[1]);
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

        index = normalizedIndex;
        ensureHeroSlideBackground(activeSlide, "high");
        if (slides.length > 1) scheduleHeroBackgroundPreload(slides[(normalizedIndex + 1) % slides.length]);
        slides.forEach(function (slide, itemIndex) {
          var isActive = itemIndex === index;
          slide.classList.toggle("is-active", isActive);
          slide.setAttribute("aria-hidden", isActive ? "false" : "true");
          slide.inert = !isActive;
        });
        dots.forEach(function (dot, itemIndex) {
          var isActive = itemIndex === index;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-selected", isActive ? "true" : "false");
          dot.tabIndex = isActive ? 0 : -1;
        });
        if (shouldAnimate === false) {
          if (window.gsap) clearMotionStyles(window.gsap, slides);
        } else if (previousSlide !== activeSlide) {
          animateHeroSlide(carousel, previousSlide, activeSlide, direction);
        }
      }

      function syncAutoplayControl() {
        if (!autoplayToggle) return;
        var reducedMotion = prefersReducedMotion();
        var isPaused = userPaused || reducedMotion;
        var label = isPaused ? "继续自动轮播" : "暂停自动轮播";
        if (reducedMotion) label = "自动轮播已关闭";
        autoplayToggle.classList.toggle("is-paused", isPaused);
        autoplayToggle.setAttribute("aria-pressed", isPaused ? "true" : "false");
        autoplayToggle.setAttribute("aria-label", label);
        autoplayToggle.title = label;
        autoplayToggle.disabled = reducedMotion;
        carousel.toggleAttribute("data-carousel-autoplay-paused", isPaused || !carouselInViewport);
      }

      function start() {
        if (slides.length < 2 || timer || document.hidden || prefersReducedMotion() || carouselHasFocus || userPaused || !carouselInViewport) return;
        timer = window.setInterval(function () {
          activate(index + 1);
        }, 5200);
      }

      function stop() {
        if (!timer) return;
        window.clearInterval(timer);
        timer = null;
      }

      if ("IntersectionObserver" in window) {
        carousel.setAttribute("data-carousel-autoplay-paused", "");
        carouselAutoplayObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.target !== carousel) return;
            carouselInViewport = entry.isIntersecting;
            syncAutoplayControl();
            if (carouselInViewport) {
              start();
            } else {
              stop();
            }
          });
        }, { threshold: 0.01 });
        carouselAutoplayObserver.observe(carousel);
      }

      if (autoplayToggle) {
        autoplayToggle.addEventListener("click", function () {
          if (prefersReducedMotion()) return;
          userPaused = !userPaused;
          stop();
          syncAutoplayControl();
          if (!userPaused) start();
        });
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
        dot.addEventListener("keydown", function (event) {
          var nextIndex = itemIndex;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            nextIndex = (itemIndex + 1) % dots.length;
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            nextIndex = (itemIndex - 1 + dots.length) % dots.length;
          } else if (event.key === "Home") {
            nextIndex = 0;
          } else if (event.key === "End") {
            nextIndex = dots.length - 1;
          } else {
            return;
          }

          event.preventDefault();
          stop();
          activate(nextIndex, false);
          dots[nextIndex].focus();
          start();
        });
      });

      carousel.addEventListener("mouseenter", stop);
      carousel.addEventListener("mouseleave", start);
      carousel.addEventListener("focusin", function () {
        carouselHasFocus = true;
        stop();
      });
      carousel.addEventListener("focusout", function (event) {
        if (!carousel.contains(event.relatedTarget)) {
          carouselHasFocus = false;
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
      syncAutoplayControl();
      start();
    });
  }

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initHeroCarousel = initHeroCarousel;
  window.PingFangVideo.initGsapMotion = initGsapMotion;
  window.PingFangVideo.initHomeMotion = initHomeMotion;
  window.PingFangVideo.initMediaFallbacks = initMediaFallbacks;
  initHeroCarousel(document);
  initMediaFallbacks(document);
  initHomeMotion(document);

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
