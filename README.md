# Pilzwetter

A static site that charts the last 14 days and the next 3 for any place in
Switzerland (with a pick list for the canton of Bern) and scores every day
0–100 for how promising the woods look for _Pilze sammeln_. The page is in
German; code, comments and these docs are in English.

- **Place**: pick from an alphabetical list of ~50 places across the canton,
  or type any Swiss place name (a village, a pass like _Jaunpass_, a summit, a
  field name). Suggestions come from the [swisstopo location
  search](https://api3.geo.admin.ch/), canton of Bern first. The choice is kept
  in the URL (`?ort=Thun`, or `?ort=Jaunpass&lat=…&lon=…`) and in
  localStorage.
- **Weather** from [Open-Meteo](https://open-meteo.com/) (free, no API key) for
  the place's coordinates, fetched live in the browser. For Switzerland its
  default model mix includes MeteoSwiss ICON-CH.
- **Model**: a small water-balance + phenology model, described in
  [MODEL.md](MODEL.md). Every parameter is documented there and can be changed
  live in the page's "Modellparameter" panel.
- **Scenarios**: `scenarios.html` shows 26 reference weather situations with
  the expected rating, for experienced foragers to review. Their answers can be
  copied as text and sent back.

## Development

Requires [Bun](https://bun.sh/).

```shell
bun install          # also points git at .hooks/ (format, lint, types, tests before each commit)
bun run dev          # dev server with hot reload: http://localhost:8080
bun run test         # unit + scenario tests
bun run scenarios    # every scenario's score and factor breakdown as a table
bun run build        # bundle into docs/
bun run preview      # serve docs/ at http://localhost:8080
```

Other scripts: `format`, `format:check`, `lint`, `lint:fix`, `typecheck`,
`docs:params` (regenerate the parameter reference in MODEL.md),
`observations` (check the model against recorded finds, see below).

### Layout

```
index.html, scenarios.html   the two pages (entry points for the bundler)
src/model/                   the model: pure TypeScript, no DOM, fully tested
src/app/                     browser code: weather, place search, picker, charts, parameter panel
src/pages/                   one entry script per page
src/styles.css
scripts/                     build, scenario report, parameter docs, observations
calibration/                 real-world observations for `bun run observations`
docs/                        build output, served by GitHub Pages
```

### Tests

`bun test` covers the model step by step (curves, water balance, factors,
modifiers, the full score), the reference scenarios (each must land in its
expected rating band, the comparisons must hold, and a snapshot pins every
score so that any parameter change shows up in review), the parameter
documentation (complete, and MODEL.md up to date), and the browser-side logic
that does not need a browser: Open-Meteo and swisstopo parsing against
recorded responses in `src/app/fixtures/`, place filtering, URL and storage
handling, and the review export.

Three scenarios are open questions for reviewers and show up as `todo`; see
[MODEL.md](MODEL.md#open-questions).

### Checking against real finds

Add what foragers actually found to `calibration/observations.json` (place,
coordinates, date, observed rating; the format is in
`scripts/observations.ts`) and run `bun run observations`. It fetches the
historical weather from the Open-Meteo archive and prints the model's verdict
next to each observation.

## Deploying

The site is static. GitHub Pages serves it from the `docs/` folder:

1. `bun run build` and commit `docs/` together with the source change.
2. Once, in the repository settings: _Pages → Build and deployment → Deploy
   from a branch → `main`, folder `/docs`_.

Asset paths are relative, so the site works under `https://<user>.github.io/<repo>/`.
The build stamps its time into the footer ("Version vom …") to make it easy to
see which version is live.

## Caveat

This scores _weather_, nothing else. It knows nothing about which species are
up, whether the stand is right, or who got there first, and a good score is not
a permit: check the cantonal rules (Bern has closed days and quantity limits).
**Never eat a mushroom on the strength of a forecast, only on the strength of
an identification.** In doubt, take the basket to a
[VAPKO](https://www.vapko.ch/) inspector.
