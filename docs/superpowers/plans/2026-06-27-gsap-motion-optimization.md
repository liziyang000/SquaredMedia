# GSAP Motion Optimization Implementation Plan

> 当前状态（2026-07-17）：这是已被后续迭代取代的历史计划，不应直接执行。当前测试明确要求不存在 `initRevealMotion`、`IntersectionObserver`、`data-gsap-reveal-*` 和卡片 GSAP hover；现行行为见 `docs/theme-and-preview.md`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the homepage GSAP motion and add lightweight all-site reveal motion for the MacCMS `pingfangvideo` theme.

**Architecture:** Keep the motion system in `template/pingfangvideo/js/app.js`, because GSAP is already loaded globally from `public/foot.html`. Use `gsap.matchMedia()` for reduced-motion and hover capability gates, a single `IntersectionObserver` for all-site reveal batches, and small CSS support rules only for transition conflicts and short-lived compositor hints.

**Tech Stack:** MacCMS V10 templates, vanilla JavaScript, GSAP core, Node.js assertion tests, existing template lint and preview verification scripts.

---

## File Structure

- Modify `tests/template.test.mjs`: add string-level regression checks for the new reveal layer, observer lifecycle, hover selectors, and reduced-motion cleanup.
- Modify `template/pingfangvideo/js/app.js`: refactor GSAP helpers, improve homepage timeline timing, add all-site reveal observer, expand hover bindings, and expose `PingFangVideo.initGsapMotion`.
- Modify `template/pingfangvideo/css/style.css`: add scoped CSS support for GSAP-controlled elements and reduced-motion cleanup without changing layout.
- No production HTML template changes are planned.

## Task 1: Add Motion Regression Tests

**Files:**
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Add failing assertions for the expanded GSAP motion layer**

Insert these assertions near the existing `appJs` GSAP assertions:

```js
assert.match(appJs, /initRevealMotion/);
assert.match(appJs, /IntersectionObserver/);
assert.match(appJs, /data-gsap-reveal-ready/);
assert.match(appJs, /data-gsap-revealed/);
assert.match(appJs, /\.page-title/);
assert.match(appJs, /\.filter-panel/);
assert.match(appJs, /\.content-section/);
assert.match(appJs, /\.detail-grid/);
assert.match(appJs, /\.episode-box/);
assert.match(appJs, /\.player-shell/);
assert.match(appJs, /category-tile/);
assert.match(appJs, /timeline-item/);
assert.match(appJs, /record-item/);
assert.match(appJs, /list-item/);
assert.match(appJs, /revealBatchSize/);
assert.match(appJs, /observer\.unobserve/);
assert.match(appJs, /willChange/);
assert.match(appJs, /clearProps: "transform,opacity,visibility,willChange"/);
assert.match(appJs, /clearProps: "transform,opacity,visibility,willChange,zIndex"/);
assert.match(appJs, /bindGsapHover\(scope, "\\.category-tile"/);
assert.match(appJs, /bindGsapHover\(scope, "\\.episode-grid a"/);
assert.match(appJs, /bindGsapPressFeedback/);
assert.match(appJs, /PingFangVideo\.initGsapMotion = initGsapMotion/);
```

Insert these assertions near the existing `style` GSAP assertions:

```js
assert.match(style, /\[data-gsap-reveal-ready="true"\]/);
assert.match(style, /\[data-gsap-revealed="true"\]/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(style, /\[data-gsap-carousel="true"\] \.hero-slide/);
```

Replace the existing `appJs` assertion:

```js
assert.match(appJs, /clearProps: "transform,opacity,visibility,zIndex"/);
```

with:

```js
assert.match(appJs, /clearProps: "transform,opacity,visibility,willChange,zIndex"/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test
```

Expected: fail with an assertion mentioning `initRevealMotion` or another new GSAP reveal string, proving the test covers unimplemented behavior.

- [ ] **Step 3: Commit the failing regression test**

Run:

```bash
git add tests/template.test.mjs
git commit -m "test: cover expanded gsap motion layer"
```

Expected: commit succeeds with only `tests/template.test.mjs` staged.

## Task 2: Implement GSAP Motion Helpers And Reveal Layer

**Files:**
- Modify: `template/pingfangvideo/js/app.js`

- [ ] **Step 1: Replace the current `clearMotionStyles`, hover binding, and `initGsapMotion` block with helper functions**

Replace the existing GSAP helper block from `function clearMotionStyles(gsap, targets)` through the end of `function initGsapMotion(root)` with this implementation:

```js
  var revealBatchSize = 18;
  var revealSelectors = [
    ".page-title",
    ".filter-panel",
    ".content-section",
    ".detail-grid",
    ".episode-box",
    ".player-shell",
    ".vod-card",
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

    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      revealTargets(gsap, targets);
      return;
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
      var entranceTargets = scopedElements(scope, ".hero-carousel .stat-card, .hero-rank .rank-item, .vod-card, " + revealSelectors);
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
      var cards = scopedElements(scope, ".vod-card").slice(0, 12);

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
```

- [ ] **Step 2: Run test and verify the new JS assertions pass or expose syntax mistakes**

Run:

```bash
npm test
```

Expected: either pass all tests or fail only on CSS assertions from Task 3.

- [ ] **Step 3: Commit the JS implementation**

Run:

```bash
git add template/pingfangvideo/js/app.js
git commit -m "feat: expand gsap motion layer"
```

Expected: commit succeeds with only `app.js` staged.

## Task 3: Add CSS Support For GSAP-Controlled States

**Files:**
- Modify: `template/pingfangvideo/css/style.css`

- [ ] **Step 1: Add scoped CSS support near the existing GSAP carousel rule**

Add this CSS after `.hero-carousel[data-gsap-carousel="true"] .hero-slide`:

```css
[data-gsap-reveal-ready="true"],
[data-gsap-revealed="true"] {
  backface-visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  [data-gsap-carousel="true"] .hero-slide,
  [data-gsap-reveal-ready="true"],
  [data-gsap-revealed="true"] {
    transition: none;
  }
}
```

- [ ] **Step 2: Run test and verify style assertions pass**

Run:

```bash
npm test
```

Expected: pass.

- [ ] **Step 3: Commit CSS support**

Run:

```bash
git add template/pingfangvideo/css/style.css
git commit -m "style: support gsap reveal states"
```

Expected: commit succeeds with only `style.css` staged.

## Task 4: Run Required Verification

**Files:**
- No edits expected.

- [ ] **Step 1: Run the full required test command**

Run:

```bash
npm test
```

Expected: exit 0.

- [ ] **Step 2: Run template lint**

Run:

```bash
npm run lint:template
```

Expected: exit 0.

- [ ] **Step 3: Run compatibility verification**

Run:

```bash
npm run verify:compat
```

Expected: exit 0.

- [ ] **Step 4: Run preview verification**

Run:

```bash
npm run verify:preview
```

Expected: exit 0.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- template/pingfangvideo/js/app.js template/pingfangvideo/css/style.css tests/template.test.mjs
```

Expected: only intended motion, CSS, and test changes appear.

- [ ] **Step 6: Commit final verification-only changes if any**

Run only if Task 4 revealed small fixups:

```bash
git add tests/template.test.mjs template/pingfangvideo/js/app.js template/pingfangvideo/css/style.css
git commit -m "fix: finalize gsap motion verification"
```

Expected: commit succeeds, or no commit is needed if the worktree is clean.
