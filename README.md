# Heli Briefing

A helicopter weather and briefing workspace for a South Bohemian professional pilot preparing briefings for others, with regional context for Czechia and Central Europe.

The goal is to bring a regional weather picture, detailed graphs, local observations and source comparison into a coherent interface with few repeated actions. Information depth and simple interaction are both requirements.

**Status:** v0.3 evaluation implementation. [Open Heli Briefing](https://xefensor.github.io/heli-briefing/). Browser-native JavaScript, HTML, CSS and SVG charts; GitHub Pages hosting and scheduled collectors. See [deployment evidence](docs/deployment.md) and the [release checklist](docs/release-checklist.md) for what is verified and what still requires access or pilot review.

The workspace combines eight aligned forecast graphs, explicit ALADIN / ICON-D2 / ECMWF comparison, a six-level point profile, native ICON-D2 CEILING, original METAR/TAF/SIGMET, station history, observed radar playback, GeoColour satellite imagery, three timestamped ČHMÚ cameras, SWL and low-cloud charts. Saved points and a single viewing time reduce repeated setup. An optional six-point route has its own departure and leg times, coordinated point comparison, weather sections and separately referenced ČÚZK terrain.

Prepare a briefing to capture the available data, notes and images in a standalone HTML file, or use the compact METAR/TAF pack and text copy. Missing feeds, unsupported fields and stale data remain visible. Professional provider access and intended-pilot validation remain external release gates; this public evaluation is not a claim of operational readiness.

The [three studies](docs/README.md) guide the product; the original pilot-authored page supplies context rather than a fixed specification. The latest [implementation decision](docs/decisions/0010-route-section-and-visual-evidence.md) records source rights, section sampling and image provenance.

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
