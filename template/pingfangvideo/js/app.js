(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open");
    });
  }

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

  function lockLandscape() {
    if (!screen.orientation || !screen.orientation.lock) return;
    var lock = screen.orientation.lock("landscape");
    if (lock && lock.catch) lock.catch(function () {});
  }

  function unlockLandscape() {
    if (!screen.orientation || !screen.orientation.unlock) return;
    screen.orientation.unlock();
  }

  function requestPlayerFullscreen(shell) {
    var video = shell.querySelector("video");
    if (video && video.webkitEnterFullscreen && !video.requestFullscreen) {
      video.webkitEnterFullscreen();
      lockLandscape();
      return;
    }

    var target = shell;
    var request = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
    if (!request && video) {
      target = video;
      request = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
    }
    if (!request) return;

    var result = request.call(target);
    if (result && result.then) {
      result.then(lockLandscape).catch(function () {});
    } else {
      lockLandscape();
    }
  }

  function initPlayerFullscreen(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-player-fullscreen]").forEach(function (button) {
      if (button.dataset.playerFullscreenReady === "true") return;
      button.dataset.playerFullscreenReady = "true";
      button.addEventListener("click", function () {
        var page = button.closest(".player-page") || document;
        var shell = page.querySelector(".player-shell");
        if (!shell) return;
        requestPlayerFullscreen(shell);
      });
    });
  }

  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement) unlockLandscape();
  });

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

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initSearchForms = initSearchForms;
  window.PingFangVideo.initPlayerFullscreen = initPlayerFullscreen;
  window.PingFangVideo.clearFavoriteCache = clearFavoriteCache;
  window.PingFangVideo.initFavoriteButtons = initFavoriteButtons;
  window.PingFangVideo.initPageJumpForms = initPageJumpForms;

  initSearchForms(document);
  initPlayerFullscreen(document);
  showQueuedSiteNotice();
  initLoginForms(document);
  initFavoriteButtons(document);
  initPageJumpForms();

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

      if (slides.length === 0) return;
      carousel.dataset.carouselReady = "true";

      function activate(nextIndex) {
        index = (nextIndex + slides.length) % slides.length;
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
      }

      function start() {
        if (slides.length < 2 || timer) return;
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
      activate(0);
      start();
    });
  }

  window.PingFangVideo = window.PingFangVideo || {};
  window.PingFangVideo.initHeroCarousel = initHeroCarousel;
  initHeroCarousel(document);

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
