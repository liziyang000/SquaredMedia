# Poster Magazine Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third user-selectable `poster-magazine` theme with a poster-magazine homepage treatment and a theme-switch transition.

**Architecture:** Keep the current MacCMS template structure intact. Extend the existing theme switcher and theme persistence code, then scope the new layout and visual effects entirely under `html[data-theme="poster-magazine"]` so default and `blue-pink-purple` layouts remain stable.

**Tech Stack:** MacCMS V10 templates, plain CSS, plain JavaScript, existing `npm test` template assertions, existing package/deploy scripts.

---

## File Structure

- Modify `template/pingfangvideo/html/public/include.html`: allow the early theme script to apply `poster-magazine` before CSS loads.
- Modify `template/pingfangvideo/html/public/head.html`: add desktop and mobile “海报杂志” theme options.
- Modify `template/pingfangvideo/js/app.js`: add `poster-magazine` to the valid theme map and wrap user-triggered theme changes in a short transition class.
- Modify `template/pingfangvideo/css/style.css`: add the new swatch, transition overlay, `poster-magazine` tokens, homepage hero layout, floating rank panel, magazine shelf cards, shared glass surfaces, and responsive safeguards.
- Modify `tests/template.test.mjs`: add regression assertions for the new theme option, early script, JS valid themes, transition state, and scoped CSS rules.

## Task 1: Failing Test Coverage

**Files:**
- Modify: `tests/template.test.mjs`

- [ ] **Step 1: Add assertions for the new theme**

Add checks near the existing theme-switcher assertions:

```js
const include = readThemeFile("html/public/include.html");

assert.match(include, /theme === "poster-magazine"/);
assert.match(head, /data-theme-option="poster-magazine" aria-pressed="false"[\s\S]*?<span>海报杂志<\/span>/);
assert.match(appScript, /"poster-magazine": true/);
assert.match(appScript, /theme-transitioning/);
assert.match(style, /\.theme-option-swatch-poster/);
assert.match(style, /html\[data-theme="poster-magazine"\]/);
assert.match(style, /html\[data-theme="poster-magazine"\]\s+\.hero-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(style, /html\[data-theme="poster-magazine"\]\s+\.hero-rank\s*\{[\s\S]*position: absolute/);
assert.match(style, /html\.theme-transitioning::before/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*theme-transitioning/);
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test
```

Expected: `npm test` fails because `poster-magazine` is not present in the templates, JavaScript, and CSS yet.

## Task 2: Theme Option Markup And Early Theme Script

**Files:**
- Modify: `template/pingfangvideo/html/public/include.html`
- Modify: `template/pingfangvideo/html/public/head.html`

- [ ] **Step 1: Update the early theme script**

Change the theme check from only accepting `blue-pink-purple` to accepting both persisted custom themes:

```js
if (theme === "blue-pink-purple" || theme === "poster-magazine") {
  document.documentElement.setAttribute("data-theme", theme);
} else {
  document.documentElement.removeAttribute("data-theme");
}
```

- [ ] **Step 2: Add desktop and mobile theme option buttons**

Add this button after the existing “蓝粉紫” option in both desktop and mobile theme option groups:

```html
<button class="theme-option" type="button" data-theme-option="poster-magazine" aria-pressed="false">
  <span class="theme-option-swatch theme-option-swatch-poster" aria-hidden="true"></span>
  <span>海报杂志</span>
</button>
```

- [ ] **Step 3: Run the targeted test**

Run:

```bash
npm test
```

Expected: the include/head assertions pass, while app/CSS assertions still fail.

## Task 3: Theme Switch Transition Logic

**Files:**
- Modify: `template/pingfangvideo/js/app.js`

- [ ] **Step 1: Add the theme to the valid theme map**

Change:

```js
var validThemes = {
  "blue-pink-purple": true
};
```

to:

```js
var validThemes = {
  "blue-pink-purple": true,
  "poster-magazine": true
};
```

- [ ] **Step 2: Add transition helpers**

Add near `themeSwitcherDocumentReady`:

```js
var themeTransitionTimer = null;
```

Add helper functions before `applyTheme`:

```js
function clearThemeTransition() {
  if (themeTransitionTimer) {
    window.clearTimeout(themeTransitionTimer);
    themeTransitionTimer = null;
  }
  document.documentElement.classList.remove("theme-transitioning");
}

function scheduleThemeTransition() {
  clearThemeTransition();
  document.documentElement.classList.add("theme-transitioning");
  themeTransitionTimer = window.setTimeout(clearThemeTransition, 560);
}
```

- [ ] **Step 3: Keep programmatic startup quiet but animate user clicks**

Change `applyTheme(theme, shouldPersist)` so it schedules the transition only when persisting a user action:

```js
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
  ...
}
```

- [ ] **Step 4: Run JavaScript syntax and template tests**

Run:

```bash
node --check template/pingfangvideo/js/app.js
npm test
```

Expected: JS syntax passes; CSS assertions still fail.

## Task 4: Poster Magazine CSS Theme

**Files:**
- Modify: `template/pingfangvideo/css/style.css`

- [ ] **Step 1: Add the poster swatch**

Add beside the existing swatch styles:

```css
.theme-option-swatch-poster {
  background: conic-gradient(from 140deg, #38bdf8 0 20%, #ff4fd8 20% 48%, #8b5cf6 48% 72%, #b6ff6a 72% 82%, #050613 82% 100%);
}
```

- [ ] **Step 2: Add transition overlay styles**

Add a fixed overlay using the root pseudo-element:

```css
html.theme-transitioning::before {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: radial-gradient(circle at 24% 30%, rgba(56, 189, 248, 0.42), transparent 30%), radial-gradient(circle at 74% 42%, rgba(255, 79, 216, 0.38), transparent 34%), linear-gradient(120deg, rgba(5, 6, 19, 0.2), rgba(139, 92, 246, 0.2), rgba(5, 6, 19, 0.12));
  content: "";
  opacity: 0;
  pointer-events: none;
  animation: theme-flare 0.56s ease both;
}

@keyframes theme-flare {
  0% {
    opacity: 0;
    transform: scale(1.03);
    filter: blur(18px) saturate(1.45);
  }
  42% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1);
    filter: blur(0) saturate(1);
  }
}
```

Inside the existing reduced-motion media block or a new one:

```css
@media (prefers-reduced-motion: reduce) {
  html.theme-transitioning::before {
    animation: theme-flare-reduced 0.16s ease both;
    filter: none;
    transform: none;
  }

  @keyframes theme-flare-reduced {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 0.38;
    }
  }
}
```

- [ ] **Step 3: Add poster magazine tokens and shared surfaces**

Add a new scoped block:

```css
html[data-theme="poster-magazine"] {
  --pm-ink: #050613;
  --pm-paper: #f8f3ff;
  --pm-cyan: #38bdf8;
  --pm-pink: #ff4fd8;
  --pm-violet: #8b5cf6;
  --pm-lime: #b6ff6a;
  --bg: var(--pm-ink);
  --panel: rgba(9, 12, 31, 0.72);
  --panel-soft: rgba(25, 17, 52, 0.76);
  --text: var(--pm-paper);
  --muted: #d7cbe8;
  --line: rgba(248, 243, 255, 0.16);
  --line-strong: rgba(255, 79, 216, 0.42);
  --accent: var(--pm-pink);
  --accent-2: var(--pm-cyan);
  --gold: var(--pm-lime);
  --surface: rgba(255, 255, 255, 0.07);
  --surface-strong: rgba(255, 255, 255, 0.13);
  --shadow: 0 32px 96px rgba(0, 0, 0, 0.52), 0 0 52px rgba(255, 79, 216, 0.16);
  --shadow-soft: 0 20px 56px rgba(0, 0, 0, 0.38), 0 0 32px rgba(56, 189, 248, 0.1);
  --focus-ring: 0 0 0 3px rgba(56, 189, 248, 0.34), 0 0 0 6px rgba(255, 79, 216, 0.14);
}
```

- [ ] **Step 4: Add poster magazine homepage layout rules**

Add rules scoped to `html[data-theme="poster-magazine"]` for:

```css
html[data-theme="poster-magazine"] body { ... }
html[data-theme="poster-magazine"] .site-header { ... }
html[data-theme="poster-magazine"] .hero { ... }
html[data-theme="poster-magazine"] .hero-grid { grid-template-columns: minmax(0, 1fr); ... }
html[data-theme="poster-magazine"] .hero-carousel { ... }
html[data-theme="poster-magazine"] .hero-rank { position: absolute; ... }
html[data-theme="poster-magazine"] .banner-copy strong { font-size: clamp(44px, 7vw, 96px); ... }
html[data-theme="poster-magazine"] .home-shelf-rail { display: grid; ... }
html[data-theme="poster-magazine"] .home-shelf-card:first-child { grid-column: span 2; ... }
```

Keep all selectors scoped under `html[data-theme="poster-magazine"]`.

- [ ] **Step 5: Add responsive safeguards**

Inside the 1020px and 640px media ranges, add scoped overrides that set `.hero-rank` back to normal flow, reduce hero height, and prevent horizontal overflow:

```css
@media (max-width: 1020px) {
  html[data-theme="poster-magazine"] .hero-rank {
    position: relative;
    right: auto;
    bottom: auto;
    width: auto;
  }
}

@media (max-width: 640px) {
  html[data-theme="poster-magazine"] .hero-slide {
    min-height: 520px;
    padding: 28px 20px 86px;
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test
```

Expected: all theme assertions pass.

## Task 5: Verification And Deploy

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run syntax and whitespace checks**

Run:

```bash
node --check template/pingfangvideo/js/app.js
git diff --check -- template/pingfangvideo/html/public/include.html template/pingfangvideo/html/public/head.html template/pingfangvideo/js/app.js template/pingfangvideo/css/style.css tests/template.test.mjs
```

Expected: both commands exit 0.

- [ ] **Step 2: Run required theme verification**

Run:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

Expected: all commands exit 0.

- [ ] **Step 3: Run release verification**

Run:

```bash
npm run package
npm run verify:release
```

Expected: both commands exit 0 and verify the generated release archives.

- [ ] **Step 4: Deploy to ping2**

Run:

```bash
source scripts/deploy-ping2.env && npm run deploy
```

Expected: deploy script runs tests, packages, verifies release archives, installs addon files, clears MacCMS cache, and deploys `pingfangvideo` to `root@ping2.my:/www/wwwroot/ping2.my/template/pingfangvideo`.

- [ ] **Step 5: Confirm deployed files contain the new theme**

Run:

```bash
ssh root@ping2.my "grep -n 'poster-magazine' /www/wwwroot/ping2.my/template/pingfangvideo/js/app.js /www/wwwroot/ping2.my/template/pingfangvideo/css/style.css /www/wwwroot/ping2.my/template/pingfangvideo/html/public/head.html | head"
```

Expected: remote output shows `poster-magazine` in JS, CSS, and the public head template.
