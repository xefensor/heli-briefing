# Heli Briefing

A helicopter weather and briefing workspace for a South Bohemian professional pilot preparing briefings for others, with regional context for Czechia and Central Europe.

The goal is to bring a regional weather picture, detailed graphs, local observations and source comparison into a coherent interface with few repeated actions. Information depth and simple interaction are both requirements.

**Status:** v0.2 evaluation [published on GitHub Pages](https://xefensor.github.io/heli-briefing/), with deployment confirmed on **1 November 2026**. Source in `web/` uses browser-native JavaScript modules, HTML, CSS and SVG charts. The rebuild is guided by research into pilot needs, aviation interfaces and data sources. The pilot-authored original supplies context and candidate information needs; its features and workflow remain open to redesign. Pilot validation, the exact reporting schedule and some data agreements remain open.

**Latest interface pass:** larger type, aligned full-width forecast rows, a larger regional map, direct section navigation and a distance-sorted station comparison above readable complete reports. See [design and validation](docs/design.md#implemented-readability-pass--1-november-2026).

**v0.2 includes:** an independently labelled native ICON-D2 ceiling diagnostic, conservative structured reports and twelve-hour METAR history, a two-hour radar sequence, automatic freshness checks, a report-output preview and frozen HTML export with browser-local archives. [Release evidence and verification limits](docs/deployment.md) distinguish passing tests, browser checks and publication. The next extension adds a six-level point profile, independent GeoColour satellite imagery and preview-first output; [implementation and validation](docs/decisions/0006-point-profile-and-satellite.md). Integrated cameras and full route cross-sections remain future scope.

## Start here

- [Documentation index](docs/README.md)
- [Product brief and confirmed requirements](docs/product-brief.md)
- [Original site content and workflow](docs/research/original-site.md)
- [Design principles and proposed interactions](docs/design.md)
- [Pilot needs and evidence](docs/research/pilot-needs.md)
- [Interface references](docs/research/interface-references.md)
- [Data sources and access](docs/data/sources.md)
- [Data integrity requirements](docs/data/integrity.md)
- [Proposed architecture](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Build and deployment](docs/deployment.md)
- [Decision register](docs/decisions/README.md)

Research was checked on **1 November 2026**. Feed capabilities, access conditions and prices can change; dated observations are not uptime or accuracy guarantees.

## Working on the project

Read [AGENTS.md](AGENTS.md) before changing the repository and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

Use Node.js 24 and Python 3. The browser application and build need no npm dependency installation. Native cloud ingestion has separate pinned Python decoder requirements, covered in the deployment guide. Run from the repository root:

```sh
npm test
python3 scripts/check_docs.py
npm run build
npm run dev
git diff --check
```

`npm run dev` serves the browser application locally. `npm run build` copies public assets from `web/` to ignored `dist/`; it does not publish them. The Python documentation checker validates local links without contacting weather providers. The [deployment guide](docs/deployment.md) covers report refresh, Pages setup and verification.

## Data and licensing

The build uses an Open-Meteo forecast adapter for ČHMÚ ALADIN, DWD ICON and ECMWF, collected AviationWeather.gov reports, ČHMÚ observed radar and a native DWD ICON-D2 ceiling crop. Sources retain their own identities, validity periods and reuse conditions. Model forecasts, measurements and calculated astronomy are different products. The v0.2 release passed 105 local tests and published successfully; local browser checks covered desktop/390 px layouts, retained inspection time, radar history and frozen report preview. Pilot usability and forecast skill remain unvalidated; file-download completion has not been captured by the browser check. No provider uptime guarantee is implied.

Open-Meteo's free hosted API is used for this open-source evaluation version under its applicable terms. Professional/commercial production use needs appropriate provider access. Any private API key requires a server-side adapter or ingestion service; it cannot be kept secret on GitHub Pages.

The [source catalogue](docs/data/sources.md) records access and licensing constraints. Collected reports preserve source attribution and timestamps; external imagery retains its source and rights. A project code and documentation licence has not been selected; public repository access does not itself grant a reuse licence.
