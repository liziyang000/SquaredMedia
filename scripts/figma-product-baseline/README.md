# Squared Media Figma Product Baseline

This local Figma development plugin keeps the product design baseline aligned
with the current MacCMS source in `template/pingfangvideo`.

The Pixel Frog sync in this revision is sourced from
`master@303e3b5 + working tree`; it must not be represented as part of the
committed `303e3b5` snapshot until the theme changes are committed.

The baseline is intentionally source-backed:

- production templates, CSS, JavaScript, and image assets are the source of truth;
- existing editable Figma pages and components are reused;
- the raw html.to.design import and the production prototype are protected evidence;
- missing states are recorded as “not implemented in current code” instead of
  being silently designed;
- historical Next.js mappings are archived and never presented as current.

## Approval boundary

Phase 0 discovery is complete. Do not run any **Apply** action until the user
has explicitly approved the Phase 0 plan in the Codex task.

The plugin itself adds a second guard: every apply button is enabled only after
entering `APPLY 303e3b5`. It also enforces the required P1 → P5 dependencies
from the live validation reports. Audit, preview, and validation actions are
read-only.

## Local validation

```bash
node scripts/figma-product-baseline/build.mjs
node scripts/figma-product-baseline/validate-plan.mjs
node scripts/figma-product-baseline/smoke-plugin.mjs
```

The validator checks:

- the planned source commit and source roots;
- plugin-template undefined identifiers, including staged runtime context;
- plugin startup, read-only preview, approval, target-file, and phase guards;
- component-catalog overflow checks and the guarded RankBoard equal-fill repair;
- exactly 5 code-backed themes and 30 visual archetypes;
- 6 source-backed status roles and 5 missing component families;
- all 18 audited existing component state contracts and their source files;
- variant products and the 30-variant-per-set limit;
- page-name and archetype-ID uniqueness;
- every mapped template and component source file;
- all 14 interaction behaviors and their exact source evidence;
- the real theme options, breakpoints, and asset directories;
- an exact 40-file asset inventory with dimensions, usage, reference status,
  and color behavior;
- the four real settings surfaces and absence of an invented settings route;
- machine-output templates that stay developer-reference-only;
- the staged plugin actions and state-ledger contract;
- the P5 formal project page order, component categories, player evidence,
  clickable flow destinations, and code-coverage addendum;
- every tracked `.html`, `.css`, `.js`, `.mjs`, `.php`, `.json`, `.ini`,
  `.svg`, and `.webmanifest` file under the four current source roots; a new
  unmapped runtime file fails validation instead of silently disappearing from
  the Figma developer reference;
- absence of active `apps/web` mappings outside the explicit archive record.

## Import in Figma

1. Open the target file
   `Q2QxBpgexgeL4CcXgSYX9v`.
2. Choose **Plugins → Development → Import plugin from manifest…**.
3. Select `scripts/figma-product-baseline/manifest.json`.
4. Run **Audit**, **Audit Raw Evidence**, **Audit formal readiness**,
   **Audit component layout**, **Preview plan**, and **Final QA** first. Before
   any apply action, Final QA should report `PENDING`, not a fabricated pass.
5. After explicit Phase 0 approval, enter the apply phrase.
6. Execute one selected object at a time, following the phase order below.
7. Run the matching validation after every write and retain the returned node
   IDs for the task handoff.

### Raw Evidence audit and write protection

**Audit Raw Evidence** is read-only. It reports the protected page signature
and, for every top-level node, its name, node ID, size, direct child count,
sample text signatures, IMAGE-fill count, and 1440/768/390 viewport candidates.
Use this report to review evidence coverage before adding any future
page-building action.

The plugin treats `92 · Raw Evidence · html.to.design · 2026-07-28` and its
audited legacy aliases as immutable evidence. P1–P5 content-writing entry points
must call the shared mutable-page guard before changing a target page, and the
guard rejects Raw Evidence. Player evidence may still be read and cloned into a
separate maintained page. Formal page ordering may move the page tab but does
not change Raw Evidence children.

## Staged execution

### P1 · Foundations and themes

- preserves the existing Liquid Cinema variables;
- adds isolated primitive and semantic collections for the four other themes;
- uses one collection per theme because the target file is on Figma Starter,
  where multi-mode collections are unavailable;
- creates an editable `01 · Themes` reference page;
- binds theme swatches to variables and sets exact WEB code syntax;
- leaves gradients and multi-layer shadows documented as CSS composites.

Run **Apply P1 · Themes**, then **Validate P1**.

### P2 · Structure and documentation

Use **Apply selected structure** for exactly one mutable page operation. Renames
are limited to the audited legacy names; content is never deleted or moved.
Raw Evidence itself is audit-only and cannot be used as an Apply target.

Use **Apply selected documentation** for exactly one of:

- Baseline Guide;
- current MacCMS Code Map;
- Foundations;
- Components reuse/state contract;
- Assets & Symbols;
- Responsive Rules;
- Interaction & States;
- Developer Reference;
- Issues / Recorded Only.

The documentation uses 30 current template archetypes, all 12 real width/height
thresholds across the theme, Artplayer status overlay, and player prompts,
4 environmental media conditions, 10 responsive
patterns, 8 navigation flows, 18 existing component state contracts, the
40-file asset inventory,
implemented/missing page states, settings surfaces, and machine-output
exclusions. The asset page embeds the actual raster/GIF sources and imports the
8 Dunhuang and 12 Pixel Frog SVGs as editable vectors; duplicate source files
share one embedded blob. Run **Validate P2** after each page.

### P3 · Components

Build exactly one component family per action:

- `Action/StandardButton` — 7 source-backed sparse variants;
- `Action/FavoriteButton` — 3 variants;
- `Action/LoginSubmit` — 3 variants;
- `Form/HeaderSearch` — 3 variants;
- `Form/LoginField` — 4 variants;
- `Reference/BrowserConfirm` — 3 reference-only use cases because current
  destructive confirmation is browser-native `confirm()`/`window.confirm`;
- `Feedback/SiteNotice` — 2 variants;
- `Playback/SourceQualityStatus` — 8 variants;
- `Media/CardQualityBadge` — 1 visible variant.

Unsupported states remain written gaps instead of generated visual variants.
The existing 18 local components are reused and never rebuilt by this tool.
Run **Validate selected family** before choosing the next family.

### P4 · Page-family coverage

Apply one coverage index to one page family at a time. Each editable card
records purpose, route, components, data, template files, implemented states,
and every missing required state. Existing visual frames remain untouched.
Missing pixel-perfect screens are recorded instead of being silently invented.

Run **Validate coverage** for every family, then **Final QA**. Final QA checks
canonical pages, documentation roots, all nine current-code component sets, all nine family
indexes, minimum 44px control targets, protected raw/prototype pages, and the
`Drawer / Open` → `Hotspot / Open Drawer` prototype reference.

### P5 · Formal project prototype

Run **Audit formal readiness** first. It is read-only and reports the current
page order, maintained versus imported styles, key-page top-level geometry, and
exact `preload` / `buffering` evidence matches.

After approval and passing P1–P3 validation, apply one action at a time:

1. **Build Component Index** — creates a seven-category source/state/code index
   without changing component visuals.
2. **Integrate Player Evidence** — clones the exact editable 1440/768/390 prompt
   frames from protected Raw Evidence into Player.
3. **Build User Flows** — creates five source-backed clickable flow maps for
   discovery, playback recovery, account/devices, games, and mobile navigation.
4. **Build Project Overview** — creates the formal cover, coverage summary,
   maintenance contract, 16-group visual/non-visual code-coverage addendum,
   and quick links.
5. **Apply Formal Page Order** — reorders page tabs only; it does not move,
   delete, or redraw page content.

Then run **Validate P5** and **Final QA**. P5 requires exact page order,
non-overlapping/non-clipping formal roots, six responsive player evidence
frames, 20 connected flow-step cards, seven component categories, and passing
P2 validation after imported styles are excluded from Foundations.

### Legacy component catalog layout

**Audit component layout** checks every legacy showcase card for escaped
descendants and direct-card overlap. It also checks the current desktop
RankBoard contract: five equal fill columns, a 10px gap, and fill-sized titles.

After approval, **Fix component layout** only expands undersized showcase cards
and restores the RankBoard fill constraints. It does not change component
content, colors, typography, tablet/mobile scroll previews, raw evidence, or
the production prototype. Re-run the layout audit and **Final QA** after every
repair.

## State ledger

`state-ledger.template.json` is intentionally unapproved and contains no Figma
IDs. After the first authorized Figma write, copy it to:

```text
/tmp/dsb-state-squaredmedia-maccms-303e3b5-2026-07-28.json
```

Update it after every phase with returned page, collection, root, and component
set IDs plus validation reports. Do not create the live ledger before an
authorized write.
