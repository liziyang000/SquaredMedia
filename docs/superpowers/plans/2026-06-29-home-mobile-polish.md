# Home Mobile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the `squaredmedia` homepage mobile CSS so the hero, stats, carousel controls, quick categories, and cards feel stable and touch-friendly on small screens.

**Architecture:** Keep the MacCMS templates unchanged and make a scoped CSS-only adjustment in `template/squaredmedia/css/style.css`. Protect the change with regex-based style assertions in the existing `tests/template.test.mjs` suite, then verify with the repository's required commands and browser viewport checks.

**Tech Stack:** MacCMS V10 theme templates, CSS media queries, Node.js `assert` tests, PHP preview renderer.

---

### Task 1: Add Mobile CSS Regression Checks

**Files:**
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Add failing assertions near the existing style checks**

Add these assertions after the existing 520px mobile hero/stat checks:

```js
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-copy small\s*\{[\s\S]*-webkit-line-clamp: 2/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.quick-types\s*\{[\s\S]*overflow-x: auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.quick-types\s*\{[\s\S]*scroll-snap-type: x proximity/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.quick-types a\s*\{[\s\S]*flex: 0 0 auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*min-height: 52px/);
assert.match(style, /\.hero-carousel \.hero-stats\s*\{[\s\S]*right: 410px/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.hero-carousel \.hero-stats\s*\{[\s\S]*right: 390px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-carousel\s*\{[\s\S]*min-height: 356px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.banner-copy\s*\{[\s\S]*padding: 16px 14px 166px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-carousel \.hero-stats\s*\{[\s\S]*bottom: 60px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.banner-controls\s*\{[\s\S]*bottom: 4px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.card-meta\s*\{[\s\S]*flex-wrap: nowrap/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.card-meta span\s*\{[\s\S]*min-width: 0/);
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test
```

Expected: `npm test` fails because the new responsive rules are not present yet.

### Task 2: Implement Responsive Homepage CSS

**Files:**
- Modify: `template/squaredmedia/css/style.css`

- [ ] **Step 1: Update the 760px media block**

Inside `@media (max-width: 760px)`, change the homepage rules to this shape:

```css
.hero-grid {
  gap: 16px;
  padding: 18px 0 20px;
}

.hero-carousel {
  min-height: 372px;
}

.banner-copy {
  align-content: end;
  max-width: none;
  padding: 18px 16px 172px;
}

.banner-copy strong {
  display: -webkit-box;
  font-size: 29px;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.banner-copy small {
  font-size: 14px;
  line-height: 1.5;
  -webkit-line-clamp: 2;
}

.hero-carousel .hero-stats {
  right: 14px;
  bottom: 78px;
  left: 14px;
  max-width: none;
}

.banner-controls {
  right: 14px;
  bottom: 14px;
  left: 14px;
  justify-content: space-between;
  gap: 8px;
  min-height: 52px;
}

.quick-types {
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  margin-right: calc((100vw - var(--wrap)) / -2);
  margin-left: calc((100vw - var(--wrap)) / -2);
  padding: 14px calc((100vw - var(--wrap)) / 2) 2px;
  scroll-padding-inline: calc((100vw - var(--wrap)) / 2);
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.quick-types::-webkit-scrollbar {
  display: none;
}

.quick-types a {
  flex: 0 0 auto;
  scroll-snap-align: start;
}

.content-section {
  padding: 22px 0;
}
```

- [ ] **Step 2: Update the 520px media block**

Inside `@media (max-width: 520px)`, change or add these homepage rules:

```css
.hero-carousel {
  min-height: 356px;
}

.banner-copy {
  padding: 16px 14px 184px;
}

.banner-copy strong {
  font-size: 27px;
}

.banner-copy small {
  line-height: 1.45;
}

.hero-carousel .hero-stats {
  right: 12px;
  left: 12px;
  bottom: 60px;
}

.banner-controls {
  right: 12px;
  bottom: 4px;
  left: 12px;
}

.hero-stats {
  min-width: 0;
  gap: 7px;
}

.stat-card {
  min-width: 0;
  padding: 7px 6px;
}

.stat-card strong {
  font-size: 16px;
}

.stat-card span {
  font-size: 11px;
}

.card-meta {
  flex-wrap: nowrap;
  gap: 4px;
}

.card-meta span {
  min-width: 0;
  padding: 2px 6px;
}
```

- [ ] **Step 3: Prevent desktop hero control overlap**

Update the base hero stats rule and the 1020px breakpoint so carousel controls have separate space from the three stat cards:

```css
.hero-carousel .hero-stats {
  right: 410px;
}

@media (max-width: 1020px) {
  .hero-carousel .hero-stats {
    right: 390px;
  }
}
```

- [ ] **Step 4: Keep the change scoped**

Do not edit `template/squaredmedia/html/index/index.html`, `template/squaredmedia/html/public/head.html`, `template/squaredmedia/js/app.js`, `preview/**`, or `server/**`.

### Task 3: Verify and Inspect

**Files:**
- Read-only verification across the repository.

- [ ] **Step 1: Run the focused test**

Run:

```bash
npm test
```

Expected: exits `0`.

- [ ] **Step 2: Run the required theme checks**

Run:

```bash
npm run lint:template
npm run verify:compat
npm run verify:preview
```

Expected: each command exits `0`.

- [ ] **Step 3: Inspect rendered pages in browser**

Start the preview server:

```bash
php -S 127.0.0.1:8099 -t .
```

Check these URLs with browser viewport overrides:

```text
http://127.0.0.1:8099/server/index.php?route=home
375x812 mobile
520x812 mobile
1280x720 desktop
```

Expected: the mobile hero text, stats, and controls do not overlap; quick categories scroll horizontally; the homepage has no horizontal overflow; desktop remains visually intact.
