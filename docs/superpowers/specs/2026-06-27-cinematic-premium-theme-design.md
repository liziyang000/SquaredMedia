# Cinematic Premium Theme Design

Date: 2026-06-27

## Goal

Upgrade the `pingfangvideo` MacCMS theme from a competent dark video template to a more premium cinema-style experience while preserving MacCMS V10 compatibility, existing page coverage, and the current release verification flow.

The target impression is refined, content-first, and theatrical: a deep OLED-like backdrop, stronger poster hierarchy, restrained high-contrast controls, and mobile navigation that feels deliberate instead of cramped.

## Non-Goals

- Do not redesign the site as a light theme.
- Do not add production dependencies on localhost, preview files, Docker, npm, or other development-only resources under `template/pingfangvideo/**`.
- Do not replace MacCMS template tags, URL helpers, player variables, user log hooks, comment hooks, score hooks, digg hooks, or pagination patterns with custom runtime logic.
- Do not introduce a theme admin backend. Any admin capability remains outside this visual pass.
- Do not add heavy autoplay video backgrounds or decorative infinite animation.

## Sources And Constraints

All implementation must follow `docs/maccms-theme-development-spec.md`.

Before implementation touches any template module, read the matching official MacCMS documentation page from `https://www.maccms.la/theme`, especially:

- theme structure for shared includes and theme layout
- video templates and tags for `index`, `vod/detail`, `vod/play`, `vod/type`, and `vod/show`
- type/category tags for category and filter surfaces
- global tags and URL helpers for shared header/footer behavior

Production theme files must continue to use MacCMS runtime paths such as `{$maccms.path}`, `{$maccms.path_tpl}`, `mac_url`, `mac_url_type`, `mac_url_vod_detail`, and `mac_url_vod_play`.

## Design System

### Visual Direction

Use a cinema control-room direction:

- background: near-black, not flat black, with subtle depth between page, sections, and cards
- primary action: warm cinematic red/orange, used mainly for play/search/submit
- secondary accent: teal only for status, active filters, focus, and positive affordances
- metadata: quieter gray text, but with enough contrast for readability
- cards: poster-first, minimal chrome, consistent radius and shadow scale
- motion: short, purposeful entrance and press feedback only; reduced motion must disable decorative movement

### Token Intent

Use semantic CSS custom properties rather than introducing one-off colors:

- `--bg`: page background
- `--panel`: primary surface
- `--panel-soft`: secondary surface
- `--surface`: translucent card surface
- `--surface-strong`: elevated/hover surface
- `--text`: primary text
- `--muted`: secondary text
- `--line`: divider and card stroke
- `--accent`: primary CTA
- `--accent-2`: status/focus/active accent
- `--gold`: rating accent
- `--radius`: default radius
- `--radius-sm`: compact control radius
- `--shadow`: elevated panel shadow
- `--focus-ring`: keyboard focus color

The existing undefined `--brand-2` usages should be resolved to the token system rather than left as fallbacks.

### Typography

Keep system fonts for production reliability and Chinese rendering quality. Improve perceived polish through hierarchy, spacing, and weight rather than remote font loading:

- body text: 16px baseline where possible, with current compact density preserved on card metadata
- headings: stronger weight, balanced wrapping on modern browsers
- numeric badges and stats: tabular figures to prevent visual jitter
- no negative letter spacing

## Scope

### Header And Navigation

Improve the shared header in `template/pingfangvideo/html/public/head.html` and related CSS:

- keep logo, search, primary nav, user menu, and mobile shortcuts compatible with MacCMS runtime paths
- add a visible or screen-reader accessible search label
- preserve full navigation access below 520px; do not hide the only expandable menu without replacement
- ensure touch targets are at least 44px high/wide for header controls, carousel controls, and mobile shortcuts
- add clear `:focus-visible` styles for links, buttons, inputs, and textareas
- make active/current navigation state available where route context allows without breaking MacCMS template syntax

### Home Page

Upgrade `template/pingfangvideo/html/index/index.html` and matching CSS:

- keep the hero carousel, hot ranking, quick category strip, latest videos, and category sections
- make the hero feel more premium by increasing image presence, improving overlay depth, and tightening metadata hierarchy
- fix the mobile hero overlap where the primary CTA collides with the stat cards
- keep first hero image eager/high priority and below-fold images lazy
- enlarge carousel arrow/dot hit areas while keeping the visual controls refined
- avoid new undocumented `maccms:vod` parameters

### Video Cards

Refine `template/pingfangvideo/html/public/vod_card.html` through CSS only unless markup changes are necessary:

- preserve `mac_url_vod_detail($vo)` and `mac_url_img`
- keep poster aspect ratio and explicit image dimensions
- make title, actor, score, quality, type, and year easier to scan
- reduce visual noise from borders while keeping separation in dark mode
- ensure text truncation handles long Chinese and mixed-language names

### Category And Search Pages

Refine `vod/type.html`, `vod/show.html`, and `vod/search.html` mostly through shared CSS:

- retain documented filter links and fixed sort branches
- make active filter state more legible
- keep horizontal filter scrolling on mobile, but improve touch size and spacing
- make reset/search controls feel aligned with the premium header/search treatment

### Detail And Play Pages

Refine `vod/detail.html` and `vod/play.html` mostly through CSS:

- preserve player variables `{$player_data}` and `{$player_js}`
- keep existing history, user log, favorite, score, star, and digg hooks
- make the detail hero feel more like a title page, with stronger poster framing and cleaner action hierarchy
- keep play page focused: video surface first, controls close to the player, episode grid readable on mobile
- do not add autoplay or custom player logic in this pass

### User, Feedback, Device, And Fallback Pages

Apply the same token system and focus/touch improvements to:

- user center, login, register, password recovery
- favorites and play history
- comment, gbook/book feedback forms
- device management addon route styles
- public message, jump, verification, and fallback module pages

These pages should look coherent with the premium theme but remain quieter than the content browsing and playback surfaces.

## Interaction Requirements

- Keyboard focus must be visible without relying only on browser default outlines.
- Mobile touch targets should meet a practical 44px minimum.
- Buttons and links should use `touch-action: manipulation` where appropriate.
- Destructive actions should remain visually distinct from normal secondary actions.
- Toast/notice behavior should remain `aria-live="polite"`.
- Reduced-motion users should not receive decorative GSAP entrance or carousel motion.

## Performance Requirements

- Preserve explicit image dimensions and lazy/eager loading behavior.
- Do not introduce remote font or image dependencies in production theme files.
- Do not add heavy new JavaScript for visual polish.
- Keep GSAP behavior interruptible and transform/opacity-based.
- Avoid layout shifts in the hero and player surfaces.

## Implementation Boundaries

Expected implementation files:

- `template/pingfangvideo/css/style.css`
- `template/pingfangvideo/html/public/head.html`
- `template/pingfangvideo/html/index/index.html`
- `preview/index.html` if local preview markup must mirror production header or home hero changes

Only touch additional template files when required to keep shared styles coherent or to fix existing accessibility/interaction gaps discovered during implementation.

## Verification

After implementation, run:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

Also visually check the local preview at desktop and mobile widths:

- 1440px desktop home page
- 375px mobile home page
- 375px category page
- 375px detail page
- 375px play page

The mobile home hero must not have CTA/stat overlap, and the site must not produce horizontal page overflow.

## Success Criteria

- The first viewport reads as a premium video site, not a generic dark card grid.
- Header/navigation remains fully usable on small mobile screens.
- Hero, cards, filters, detail, and player pages share one coherent visual language.
- Accessibility improves through focus states, labels, and touch target sizing.
- MacCMS template compatibility and all existing verification commands continue to pass.
