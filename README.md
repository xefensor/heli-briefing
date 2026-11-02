# Heli Briefing

A helicopter weather and briefing workspace for a South Bohemian professional pilot preparing briefings for others, with regional context for Czechia and Central Europe.

The goal is to bring a regional weather picture, detailed graphs, local observations and source comparison into a coherent interface with few repeated actions. Information depth and simple interaction are both requirements.

**Status:** v0.5 ordinary-browser evaluation workspace. [Open Heli Briefing](https://xefensor.github.io/heli-briefing/). GitHub Pages hosts code and assets; weather is loaded directly by the browser. There are no scheduled weather builds, project data proxy or extension. See [deployment evidence](docs/deployment.md), [decision 0013](docs/decisions/0013-direct-browser-integration.md) and the [release checklist](docs/release-checklist.md).

The workspace combines eight aligned forecast graphs, explicit ALADIN / ICON-D2 / ECMWF comparison, six-level point profiles, original Czech METAR/TAF and conservatively scoped SIGMET, partial local observation history, observed radar playback and GeoColour satellite imagery. The official municipal Radnice camera opens inline on request. Original ČHMÚ camera identities, SWL/low-cloud products and native DWD ceiling remain visible as unavailable source links because no compatible direct data path was verified. Their different meanings are preserved; no proxy, old weather bundle or substitute ceiling is hidden behind them.

Saved places, one viewing time and an optional six-point route retain the existing detailed forecast/vertical/Bpv-terrain workflow. Prepare a full frozen briefing or compact report pack with original source times, partial coverage and source limits. Available satellite bytes can be embedded; radar and municipal video remain online-only source links. Historical saved briefings remain readable. This evaluation is not a claim of professional access or operational readiness.

The [three studies](docs/README.md) guide the product; the original pilot-authored page supplies context rather than a fixed specification. The current [implementation decision](docs/decisions/0013-direct-browser-integration.md) records direct runtime delivery and source/output limits; earlier decisions retain their dated rights and sampling evidence.

The [professional UI/UX review](docs/design-review-2026-11-01.md) guides the current redesign: consolidated model/comparison/time controls, direct task navigation, nearby observation evidence, readable report columns and coherent responsive/day/night presentation. Publication and actual checks are recorded in the deployment guide.

**Runtime migration, 2 November 2026:** the verified [browser-only source prototype and matrix](docs/browser-only-feasibility-2026-11-02.md) now underpin the main workspace. Source parity is incomplete: SWIM lacks some stations and initial twelve-hour history, its SIGMET inventory is not complete, and several original products cannot be read directly. These are visible dependencies, not completed capabilities.

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

Use Node.js 24 and Python 3. The browser application and build need no npm dependency installation. No provider downloads or native decoder installation are needed to build the site. Run from the repository root:

```sh
npm test
python3 scripts/check_docs.py
npm run build
npm run dev
git diff --check
```

`npm run dev` serves the browser application locally. `npm run build` copies public assets from `web/` to ignored `dist/`; it does not publish them. The Python documentation checker validates local links without contacting weather providers. The [deployment guide](docs/deployment.md) covers direct refresh, code-only Pages deployment and verification.

## Data and licensing

The browser uses explicit Open-Meteo forecast models, direct ČHMÚ SWIM TAC reports, EUMETSAT WMS imagery, provider-hosted radar PNGs and ČÚZK terrain. Astronomy is calculated locally. Reports retain raw text, observation/issue/validity dates and original issuing authority. The browser retains bounded genuine report history with original times and explicit unconfirmed cache state on reopening. Provider identity, transport success, geographic coverage and product validity remain separate.

Open-Meteo's free hosted API is used for this evaluation version under its applicable terms. Professional/commercial production use needs appropriate provider access. A private API key cannot be kept secret on GitHub Pages. Selecting a service that requires one needs a separately authorized access/architecture decision.

The [source catalogue](docs/data/sources.md) records access and licensing constraints. Collected reports preserve source attribution and timestamps; external imagery retains its source and rights. A project code and documentation licence has not been selected; public repository access does not itself grant a reuse licence.
