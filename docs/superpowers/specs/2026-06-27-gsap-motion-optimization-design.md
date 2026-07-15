# GSAP Motion Optimization Design

Date: 2026-06-27

## Goal

Improve the `squaredmedia` MacCMS theme motion system with two scopes:

- Polish the homepage hero, carousel, ranking list, stats, and first content rows.
- Add lightweight, consistent GSAP motion to common site pages without changing MacCMS template data flow.

The result should feel smoother and more intentional while keeping compatibility with MacCMS V10 template syntax and the repository's theme development spec.

## Constraints

- Keep production theme assets under `template/squaredmedia/**`.
- Do not add references to local preview files, localhost, Docker, npm commands, or development-only resources in production templates.
- Prefer MacCMS runtime paths that already exist in `public/include.html` and `public/foot.html`.
- Avoid changing MacCMS tags, URL helpers, pagination, or query parameters unless a motion marker is strictly needed.
- Respect `prefers-reduced-motion: reduce`.
- Use transform and opacity animations only for motion-heavy effects.
- Keep hover motion disabled on coarse pointer and touch devices.
- Keep the required verification commands as the completion gate:
  - `npm test`
  - `npm run lint:template`
  - `npm run verify:compat`
  - `npm run verify:preview`

## Recommended Approach

Use the existing `template/squaredmedia/js/gsap.min.js` dependency and improve `template/squaredmedia/js/app.js` as the primary integration point. Add only small CSS support where it prevents transition conflicts or improves performance.

This avoids touching many MacCMS templates and keeps the change compatible with official template structure. The existing homepage markup and shared classes already provide enough stable selectors for a motion layer.

## Homepage Motion

The homepage should keep its current carousel behavior and receive a more cohesive GSAP timeline:

- Active hero copy enters first with a short vertical reveal.
- Poster follows with a small x/scale reveal.
- Stats and ranking rows enter with subtle stagger.
- The first visible video-card group enters after the hero content.
- Carousel slide changes keep directional motion, with the outgoing slide moving opposite the incoming slide.
- Dots and arrows keep their existing DOM and accessibility attributes.

Timing should remain practical: routine UI motion under 300ms, hero entrance under about 700ms total, and stagger totals capped so the page does not feel delayed.

## All-Site Lightweight Motion

Add a generic reveal layer driven by `IntersectionObserver`:

- Observe common existing classes such as `.page-title`, `.filter-panel`, `.content-section`, `.detail-grid`, `.episode-box`, `.player-shell`, `.vod-card`, `.category-tile`, `.timeline-item`, `.record-item`, and `.list-item`.
- Animate only when elements enter the viewport.
- Batch list items with a small stagger and cap each batch so long paginated pages do not create many simultaneous tweens.
- Mark initialized elements with data attributes in JavaScript to avoid duplicate observers and duplicate tweens.
- Expose the initializer through `window.SquaredMedia` so the local preview router can re-run it after client-side route updates.

The reveal layer should not depend on ScrollTrigger or other extra plugins.

## Hover And Feedback Motion

Keep hover motion limited to devices matching `(hover: hover) and (pointer: fine)`:

- Video cards: small y lift and scale, coordinated with the existing CSS hover state.
- Ranking rows and category tiles: slight directional movement.
- Buttons and episode links: small press/hover feedback only where it does not make repeated navigation feel slow.

Use `overwrite: "auto"` so rapid mouse movement retargets instead of stacking tweens.

## Accessibility

When reduced motion is requested:

- Do not create transform-based entrance, carousel, or hover animations.
- Remove GSAP carousel marker state so CSS fallback transitions can remain predictable.
- Clear inline transform, opacity, visibility, and z-index styles from motion targets.
- Preserve all navigation, form, carousel, and MacCMS interaction behavior.

## Performance

The implementation should:

- Animate `x`, `y`, `scale`, and `autoAlpha`; avoid layout-heavy properties.
- Avoid permanent broad `will-change`; set it briefly around GSAP tweens if needed and clear it afterward.
- Avoid measuring layout during animation setup beyond static target collection.
- Use one observer and staggered batches instead of creating separate timelines for every element.
- Kill or overwrite active tweens before carousel transitions.

## Testing

Verification will cover both static compatibility and preview rendering:

- Existing tests confirm GSAP asset inclusion and no development-only production references.
- Template lint confirms MacCMS syntax remains balanced.
- Compatibility verification confirms required route files and shared includes remain valid.
- Preview verification confirms local preview pages can render with the updated scripts.

Manual review should additionally inspect homepage, category/list pages, detail pages, and reduced-motion behavior in browser dev tools.
