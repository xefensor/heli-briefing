# Heli Briefing

A helicopter weather and briefing workspace for a South Bohemian professional pilot preparing briefings for others, with regional context for Czechia and Central Europe.

The goal is to bring a regional weather picture, detailed graphs, local observations and source comparison into a coherent interface with few repeated actions. Information depth and simple interaction are both requirements.

**Status:** first evaluation version [published on GitHub Pages](https://xefensor.github.io/heli-briefing/), with deployment confirmed on **1 November 2026**. Source in `web/` uses browser-native JavaScript modules, HTML, CSS and SVG charts. The rebuild is guided by research into pilot needs, aviation interfaces and data sources. The pilot-authored original supplies context and candidate information needs; its features and workflow remain open to redesign. Pilot validation, the exact reporting schedule and some data agreements remain open.

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

Use Node.js 24 and Python 3. There are no application package dependencies to install. Run from the repository root:

```sh
npm test
python3 scripts/check_docs.py
npm run build
npm run dev
git diff --check
```

`npm run dev` serves the browser application locally. `npm run build` copies public assets from `web/` to ignored `dist/`; it does not publish them. The Python documentation checker validates local links without contacting weather providers. The [deployment guide](docs/deployment.md) covers report refresh, Pages setup and verification.

## Data and licensing

The first build uses an Open-Meteo forecast adapter for ČHMÚ ALADIN, DWD ICON and ECMWF, a collected AviationWeather.gov report snapshot and ČHMÚ radar metadata. Sources retain their own identities, validity periods and reuse conditions. Model forecasts, measurements and calculated astronomy are different products. Publication and live report/radar snapshot loading were checked; comprehensive browser behaviour and pilot usability require separate validation. No provider uptime or forecast-skill guarantee is implied.

Open-Meteo's free hosted API is used for this open-source evaluation version under its applicable terms. Professional/commercial production use needs appropriate provider access. Any private API key requires a server-side adapter or ingestion service; it cannot be kept secret on GitHub Pages.

The [source catalogue](docs/data/sources.md) records access and licensing constraints. Collected reports preserve source attribution and timestamps; external imagery retains its source and rights. A project code and documentation licence has not been selected; public repository access does not itself grant a reuse licence.
