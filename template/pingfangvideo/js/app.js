(function () {
  var toggle = document.querySelector(".nav-toggle");
  var drawer = document.querySelector(".mobile-drawer");
  var backdrop = document.querySelector(".mobile-drawer-backdrop");
  var navLinkSelector = ".site-nav a, .mobile-drawer a";
  var desktopNavQuery = window.matchMedia ? window.matchMedia("(min-width: 1021px)") : null;
  var themeStorageKey = "pingfang_theme";
  var validThemes = {
    "blue-pink-purple": true,
    "poster-magazine": true
  };
  var themeSwitcherDocumentReady = false;
  var themeTransitionTimer = null;

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

  function setThemeSwitcherOpen(switcher, isOpen) {
    var trigger = switcher.querySelector("[data-theme-switcher-trigger]");
    var menu = switcher.querySelector("[data-theme-switcher-menu]");
    if (!trigger || !menu) return;

    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    menu.hidden = !isOpen;
    switcher.classList.toggle("is-open", isOpen);
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
        closeThemeSwitchers();
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
          closeThemeSwitchers();
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
        control.tabIndex = isActive ? 0 : -1;
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
      applyTab(nextControl.getAttribute("data-home-tab") || "");
      nextControl.focus();
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

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initSearchForms = initSearchForms;
  window.PingFangVideo.initLogoutLinks = initLogoutLinks;
  window.PingFangVideo.clearFavoriteCache = clearFavoriteCache;
  window.PingFangVideo.initFavoriteButtons = initFavoriteButtons;
  window.PingFangVideo.initPageJumpForms = initPageJumpForms;
  window.PingFangVideo.initHomeLatestTabs = initHomeLatestTabs;
  window.PingFangVideo.initAutoNextPlayback = initAutoNextPlayback;
  window.PingFangVideo.initDynamicVodFilters = initDynamicVodFilters;
  window.PingFangVideo.initThemeSwitchers = initThemeSwitchers;

  initThemeSwitchers(document);
  initSearchForms(document);
  showQueuedSiteNotice();
  initLoginForms(document);
  initLogoutLinks(document);
  initFavoriteButtons(document);
  initPageJumpForms();
  initHomeLatestTabs();
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
      var autoplay = gsap.timeline({
        repeat: -1,
        yoyo: true,
        defaults: { ease: "sine.inOut" }
      });
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
        if (sensorFrame) window.cancelAnimationFrame(sensorFrame);
        if (orientationListening) window.removeEventListener("deviceorientation", handleOrientation);
        carousel.removeEventListener("pointerdown", requestDeviceOrientation);
        carousel.removeEventListener("touchstart", requestDeviceOrientation);
        carousel.removeAttribute("data-banner-iridescence");
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
      var xTo = gsap.quickTo(lens, "x", { duration: 0.72, ease: "power3.out" });
      var yTo = gsap.quickTo(lens, "y", { duration: 0.72, ease: "power3.out" });
      var opacityTo = gsap.quickTo(lens, "opacity", { duration: 0.42, ease: "power2.out" });

      function refreshBounds() {
        bounds = carousel.getBoundingClientRect();
      }

      function moveLens(event) {
        xTo(clampNumber(event.clientX - bounds.left, 0, bounds.width));
        yTo(clampNumber(event.clientY - bounds.top, 0, bounds.height));
        opacityTo(0.72);
      }

      function settleLens() {
        xTo(bounds.width * 0.72);
        yTo(bounds.height * 0.34);
        opacityTo(0.46);
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

    gsap.set(sections, { autoAlpha: 0, y: 24, willChange: "transform,opacity" });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        gsap.to(entry.target, {
          autoAlpha: 1,
          y: 0,
          duration: 0.72,
          ease: "power3.out",
          overwrite: "auto",
          clearProps: "transform,opacity,visibility,willChange"
        });
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.08
    });

    sections.forEach(function (section) {
      observer.observe(section);
    });

    return function () {
      observer.disconnect();
      gsap.killTweensOf(sections);
      gsap.set(sections, { clearProps: "transform,opacity,visibility,willChange" });
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

  function ensureCarouselDots(carousel, slides) {
    var dotsWrap = carousel.querySelector(".banner-dots");
    if (!dotsWrap || dotsWrap.querySelector("[data-carousel-dot]")) return;

    slides.forEach(function (_, itemIndex) {
      var dot = document.createElement("button");
      dot.className = "banner-dot" + (itemIndex === 0 ? " is-active" : "");
      dot.type = "button";
      dot.setAttribute("data-carousel-dot", "");
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "第" + (itemIndex + 1) + "张");
      dot.setAttribute("aria-selected", itemIndex === 0 ? "true" : "false");
      dot.tabIndex = itemIndex === 0 ? 0 : -1;
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

  function ensureHeroSlideBackground(slide) {
    if (!slide || slide.dataset.bannerBgReady) return;

    var backdrop = slide.getAttribute("data-banner-bg");
    if (!backdrop) {
      slide.dataset.bannerBgReady = "missing";
      slide.classList.add("has-missing-background");
      return;
    }

    var image = new window.Image();
    slide.dataset.bannerBgReady = "loading";
    image.onload = function () {
      slide.style.setProperty("--banner-bg", "url(" + JSON.stringify(backdrop) + ")");
      slide.dataset.bannerBgReady = "true";
      slide.classList.remove("has-missing-background");
    };
    image.onerror = function () {
      slide.style.removeProperty("--banner-bg");
      slide.dataset.bannerBgReady = "missing";
      slide.classList.add("has-missing-background");
    };
    image.src = backdrop;
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
      var index = 0;
      var timer = null;
      var carouselHasFocus = false;
      var touchStartX = null;
      var touchStartY = null;

      carousel.dataset.carouselReady = "true";
      ensureHeroSlideBackground(slides[0]);
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
        ensureHeroSlideBackground(activeSlide);
        slides.forEach(function (slide, itemIndex) {
          var isActive = itemIndex === index;
          slide.classList.toggle("is-active", isActive);
          slide.setAttribute("aria-hidden", isActive ? "false" : "true");
        });
        dots.forEach(function (dot, itemIndex) {
          var isActive = itemIndex === index;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-selected", isActive ? "true" : "false");
          dot.tabIndex = isActive ? 0 : -1;
        });
        if (shouldAnimate !== false && previousSlide !== activeSlide) {
          animateHeroSlide(carousel, previousSlide, activeSlide, direction);
        }
      }

      function start() {
        if (slides.length < 2 || timer || document.hidden || prefersReducedMotion() || carouselHasFocus) return;
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
          activate(nextIndex);
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
      start();
    });
  }

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initHeroCarousel = initHeroCarousel;
  window.PingFangVideo.initGsapMotion = initGsapMotion;
  window.PingFangVideo.initMediaFallbacks = initMediaFallbacks;
  initHeroCarousel(document);
  initMediaFallbacks(document);
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
