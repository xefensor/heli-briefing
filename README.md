# Heli Briefing

A helicopter weather and briefing workspace for a South Bohemian professional pilot preparing briefings for others, with regional context for Czechia and Central Europe.

The goal is to bring a regional weather picture, detailed graphs, local observations and source comparison into a coherent interface with few repeated actions. Information depth and simple interaction are both requirements.

**Status:** v0.8.1 ordinary-browser evaluation workspace. [Open Heli Briefing](https://xefensor.github.io/heli-briefing/). GitHub Pages hosts code and assets; weather is loaded directly by the browser. There are no scheduled weather builds, project data proxy or extension. See [deployment evidence](docs/deployment.md), [decision 0013](docs/decisions/0013-direct-browser-integration.md) and the [release checklist](docs/release-checklist.md).

The workspace combines eight aligned forecast graphs, explicit ALADIN / ICON-D2 / ECMWF comparison, six-level point profiles, original Czech METAR/TAF and conservatively scoped SIGMET, up to twelve hours of genuine observation history from the supplemental MET Norway archive and local observations, observed radar playback and GeoColour satellite imagery. The official municipal Radnice camera opens inline on request. The original SWL chart displays directly from its official ŘLP distributor, with UTC validity checked in the image header. MET Norway supplements missing LOWL/LOWW reports and LKKV TAF, with its legacy-service continuity warning. The original three ČHMÚ views now display automatically through In-počasí / Ventusky, with the original photo clock and attribution. Native DWD ICON-EU CEILING loads directly in a browser worker, with a six-hour point graph, expandable range and a regional map of actual native cell centres. The official SIGMET/AIREP image also displays directly from ŘLP, with unknown normalized issue/validity and warning completeness. The original ČHMÚ low-cloud image can be imported locally from its downloaded PNG/JSON, retaining its unverified filename clock and manual status. A separate processed ClearToFly product supplies real RUC / D2 / EU ceiling values and regional raster centres in ft AGL; model/run changes stay explicit, and its terrain/conversion details remain unknown. Automatic original low-cloud and direct native ICON-D2 MSL access remain unavailable. Their different meanings are preserved; no proxy, old weather bundle or substitute ceiling is hidden behind them.

Saved places, one viewing time and an optional six-point route retain the existing detailed forecast/vertical/Bpv-terrain workflow. Prepare a full frozen briefing or compact report pack with original source times, partial coverage and source limits. Available satellite bytes can be embedded; radar, SWL, remote cameras and municipal video remain online-only source links. Numeric native and processed ceiling series/region SVGs and the selected local low-cloud PNG can be captured offline. SIGMET/AIREP imagery remains an online-only source link. Historical saved briefings remain readable. This evaluation is not a claim of professional access or operational readiness.

The [2 November UI/UX review](docs/design-review-2026-11-02.md) and [decision 0017](docs/decisions/0017-evidence-first-workspace.md) refine the workspace around those sources: earlier ceiling evidence, direct product links, visible exact comparison values, explicit station-location actions, compact source status and stable supporting disclosures. The rich graphs and original reports remain directly available.

[Forecast failure recovery](docs/decisions/0018-forecast-failure-recovery.md) adds one bounded retry for transient errors, provider-limit cooldowns, independently rendered main/comparison results and direct per-panel retry controls. Actual cached values retain their model/place/source clocks. Provider downtime or quota limits remain visible.

The [three studies](docs/README.md) guide the product; the original pilot-authored page supplies context rather than a fixed specification. The current [implementation decision](docs/decisions/0013-direct-browser-integration.md) records direct runtime delivery and source/output limits; earlier decisions retain their dated rights and sampling evidence.

The [professional UI/UX review](docs/design-review-2026-11-01.md) guides the current redesign: consolidated model/comparison/time controls, direct task navigation, nearby observation evidence, readable report columns and coherent responsive/day/night presentation. Publication and actual checks are recorded in the deployment guide.

**Runtime migration, 2 November 2026:** the verified [browser-only source prototype and matrix](docs/browser-only-feasibility-2026-11-02.md) now underpin the main workspace. Source parity is incomplete: LKHS is still absent, history remains partial, the SWIM SIGMET inventory is incomplete, and several original products cannot be read directly. [Decision 0014](docs/decisions/0014-browser-source-gap-recovery.md) records recovered SWL/report/history routes and an actual, separate browser CEILING decoding experiment. [Decision 0015](docs/decisions/0015-native-browser-recovery.md) subsequently implements the small native decoder, original camera images and regional ceiling map. [Decision 0016](docs/decisions/0016-further-browser-source-recovery.md) adds warning-map display, manual original-map import, processed AGL evidence and the Hosín operator’s external local-station link. The remaining gaps stay visible as dependencies.

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

Use Node.js 24 and Python 3. The browser application and build need no npm dependency installation. No provider downloads or native decoder installation are needed to build the site. The narrow, tested GRIB2/AEC decoder is JavaScript served with the other static code; the former 41 MB WASM experiment is not a runtime dependency. Run from the repository root:

```sh
npm test
python3 scripts/check_docs.py
npm run build
npm run dev
git diff --check
```

`npm run dev` serves the browser application locally. `npm run build` copies public assets from `web/` to ignored `dist/`; it does not publish them. The Python documentation checker validates local links without contacting weather providers. The [deployment guide](docs/deployment.md) covers direct refresh, code-only Pages deployment and verification.

## Data and licensing

The browser uses explicit Open-Meteo forecast models, direct ČHMÚ SWIM TAC reports with a separately identified MET Norway supplement, EUMETSAT WMS imagery, provider-hosted radar PNGs, original camera images through In-počasí / Ventusky, native ICON-EU files from Source Cooperative and ČÚZK terrain. Astronomy is calculated locally. Reports retain raw text, observation/issue/validity dates and original issuing authority. The browser retains bounded genuine report history with original times and explicit unconfirmed cache state on reopening. Provider identity, transport success, geographic coverage and product validity remain separate.

Open-Meteo's free hosted API is used for this evaluation version under its applicable terms. Professional/commercial production use needs appropriate provider access. A private API key cannot be kept secret on GitHub Pages. Selecting a service that requires one needs a separately authorized access/architecture decision.

The [source catalogue](docs/data/sources.md) records access and licensing constraints. Collected reports preserve source attribution and timestamps; external imagery retains its source and rights. A project code and documentation licence has not been selected; public repository access does not itself grant a reuse licence.
