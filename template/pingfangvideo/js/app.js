(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open");
    });
  }

  document.querySelectorAll("form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      var input = form.querySelector('input[name="wd"]');
      if (input && input.value.trim().length === 0) {
        event.preventDefault();
        input.focus();
      }
    });
  });

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
