# ASTROCARE AI — Design System Overrides

Applied 2026-11-16 with the UI UX Pro Max skill (`ui_ux_pro_max`).
Generated file `MASTER.md` is the skill output and is kept unchanged below;
these overrides are the app-specific decisions made when applying it, with reasons.

## What was applied as generated

- Style: Glassmorphism — frosted panels, backdrop blur raised from 12px to 16px,
  1px light hairline border, single elevation.
- Pattern: Real-Time / Operations — dashboard first, key metrics next, live status
  labelled only when backed by a current source, with update time and stale state.
- Typography: Fira Sans for body and headings, Fira Code for data and mono
  (replacing Plus Jakarta Sans and IBM Plex Mono in `index.html`, `main.css`,
  and `charts.js`).
- Tokens: full semantic token set added to `:root` in `src/styles/main.css`
  (`--color-*`, `--space-*`, `--shadow-*`), and panels, buttons, inputs, and
  focus states now reference them instead of scattered hex values.
- Pre-delivery checklist: no emoji icons (verified, none in the app), Lucide SVG
  icons kept, visible focus states, `prefers-reduced-motion` already respected,
  responsive widths 375 / 768 / 1024 / 1440 to be checked in the browser.

## Override 1 — Category

MASTER.md labels the project "Smart Home/IoT Dashboard". That is wrong.
This is a medical astronaut-health monitoring app, so the medical domain rules
apply instead: Medical Blue + Calm Green + trust, Accessible & Ethical first.
Nothing was changed to fit the IoT label.

## Override 2 — Accent roles

MASTER.md gives one accent, green `#22C55E`, for the CTA. The app already uses
cyan `#06B6D4` / `#38BDF8` as its telemetry and information accent, and cyan
carries meaning across charts, nav, and live readings. So the app keeps two
accents with fixed roles: cyan means telemetry and information, green means
action and nominal. The primary button ("Log Reading") is now solid green with
dark text, exactly as MASTER.md specifies for the CTA. Cyan was not removed.

## Override 3 — Background depth

MASTER.md sets background `#0F172A`. The app keeps its deeper space background
`#050914`, with `#0F172A` used as the elevated surface instead. A lighter page
background would have washed out the glass panels and the chart fills. Card
`#1B2336`, muted `#272F42`, and foreground `#F8FAFC` are used as generated.

## Override 4 — Light-mode component specs rejected

MASTER.md includes a white modal and a light input spec (`border #E2E8F0`,
focus `#1E293B`). Those belong to a light theme and would be invisible or
broken on this dark app, so they were not applied. Modals, inputs, and focus
stay dark, with focus ring cyan `#38BDF8` and a soft cyan focus shadow.

## Deliberately unchanged

- Behaviour, routes, views, risk engine, and API: nothing changed.
- Status colours: low `#34D399`, moderate `#FBBF24`, high `#FB7185` — these are
  clinical semantics, and status is always text-first, never hue-only.
- Chart metric colours: heart rate cyan, SpO2 blue, temperature amber, sleep
  violet — each metric keeps its own colour so charts stay readable.
- Footer team name and copy: unchanged.

## Files changed

- `src/styles/main.css` — tokens, fonts, primary button, secondary border,
  panels, focus, input focus shadow.
- `index.html` — Google Fonts link now loads Fira Sans + Fira Code.
- `src/js/charts.js` — chart fonts now Fira Code / Fira Sans.
- `design-system/astrocare-ai/MASTER.md` — generated, unchanged.
- `design-system/astrocare-ai/preview.html` — generated palette preview.
