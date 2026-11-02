# Working on Heli Briefing

## Read before changing files

Start with [README.md](README.md), the [documentation index](docs/README.md) and [product brief](docs/product-brief.md). Read the [design document](docs/design.md) for interface work and both [data sources](docs/data/sources.md) and [data integrity](docs/data/integrity.md) for data work. Check the [decision register](docs/decisions/README.md) before treating a proposal as settled.

The repository contains research and the v0.8.1 ordinary-browser implementation in `web/`: browser-native JavaScript modules, HTML, CSS and SVG charts, with no browser package dependencies. Node.js 24 builds code/assets only in `dist/`. Python remains for deterministic tests and historical collector source; weather collection and decoder installation are not part of the deployment or runtime. The evaluation is [published on GitHub Pages](https://xefensor.github.io/heli-briefing/). Read [deployment](docs/deployment.md), [decision 0013](docs/decisions/0013-direct-browser-integration.md), [source-gap recovery](docs/decisions/0014-browser-source-gap-recovery.md), [native browser recovery](docs/decisions/0015-native-browser-recovery.md) and [further recovery](docs/decisions/0016-further-browser-source-recovery.md) for the current data path, source limits and actual validation. Distinguish publication from pilot acceptance and source coverage.

Use the three research tracks—[pilot needs](docs/research/pilot-needs.md), [aviation interfaces](docs/research/interface-references.md) and [data sources](docs/data/sources.md)—to develop the product. Read the [original-site inventory](docs/research/original-site.md) for contextual evidence and defects; its feature set, section order and controls are not an accepted specification. Do not import a rejected prototype.

## Product requirements

Owner constraint, 2026-11-02: runtime data must work in an ordinary browser, without an extension, native app, project-operated backend/proxy or build-time weather collector. GitHub Pages may host code/assets. This supersedes the earlier collector/backend target below. The current main application now uses direct browser adapters for compatible sources. Blocked products remain explicit source links, never stale deployment snapshots. Read [browser feasibility](docs/browser-only-feasibility-2026-11-02.md) before changing data paths. Preserve information depth; do not silently remove blocked products, relabel alternative cameras or pretend old snapshots are live.

- The primary user is a South Bohemian professional helicopter pilot preparing reports for others. A shift weather overview is a working assumption, not a confirmed schedule. Do not infer HEMS, aircraft capability or specific operating minima.
- Consult the original and existing research before asking the owner to speculate. Treat original features as clues to information needs, not automatic requirements or proof of the pilot's actual workflow. Evaluate what to retain, rework, replace or defer against the preparation task, research and reliable data availability.
- Preserve substantial data, graphs and original reports while reducing navigation and repeated setup.
- Keep location, time and forecast source controls prominent and stable. Source changes must update all relevant forecast panels consistently.
- Preserve the identities of observations, official reports, cameras and calculated astronomy when a forecast model changes.
- Use a helicopter and aviation visual language with readable charts and meaningful controls. ABS plastic styling is not mandatory.
- Missing or failed feeds must remain visible. Never add invented fallback weather to make a screen look complete.

## Evidence and decisions

- Keep owner-confirmed requirements, research observations, design inferences and unresolved decisions distinct.
- Owner-confirmed goals and constraints take priority. Use pilot research to propose task priorities, interface research to propose presentation and interaction, and data research to establish feasible, trustworthy capabilities. Record the reasoning when these sources point in different directions; neither the old page nor a competitor is a specification.
- A forum participant's account is qualitative evidence, not verified credentials or a representative survey.
- Product documentation demonstrates a feature or layout; it does not establish measured usability or forecast accuracy.
- Record factual sources with real URLs, the checked date and material limitations. Do not commit chat citation IDs or tool result IDs.
- Recheck time-sensitive provider capabilities and terms before implementing them. Do not claim a model is most accurate locally from grid spacing alone.
- Update the relevant documentation when a decision or integration changes. Use the decision template for substantial choices and retain superseded decisions with their status.

## Data integrity

- Preserve observation, issue, model-run, validity and retrieval times separately. An API request duration is not a forecast timestamp.
- Inspect actual availability per model, field, location and valid time. A successful response does not mean all requested fields are present.
- Preserve missing values and partial horizons. Do not replace missing with zero, interpolate across outages without explicit justification, or silently switch models.
- Handle cancelled, NIL, amended, corrected, expired and superseded reports explicitly. A latest-file endpoint can return an old or cancelled bulletin.
- Keep cloud fraction, convective cloud base, model ceiling, observed ceiling and visibility distinct. Preserve each parameter's definition and temporal statistic.
- State vertical references and units explicitly: AGL, AMSL/MSL, station-relative heights and pressure levels are not interchangeable. Check model terrain before converting heights and mask pressure levels below terrain.
- Keep forecasts separate from observations and precipitation observations separate from extrapolated radar. Apply the correct source timestamp to every layer.
- Never treat planned AUP/UUP utilisation or delayed activation history as confirmed live airspace status.
- Moon disc illumination is not measured ground illumination. Use the selected instant for calculated sun and moon positions.

## Engineering workflow

- Make routine reversible choices within the user's requested scope. Ask only when a material unresolved choice or access restriction changes what can be delivered.
- Ask the owner one question at a time. First check the original site and existing documentation for the answer. Distinguish an observed feature from an inference about how the pilot uses it.
- Keep unrelated changes out of a task. Inspect existing files and concurrent changes before editing; never overwrite another contributor's work without reconciling it.
- Maintain provider adapters and clear capability metadata. Runtime requests go directly from the browser to allowed provider APIs or provider-controlled images/viewers. Do not restore deployment collectors, project backends or CORS proxies. Any future provider requiring private credentials needs a separately authorized architecture/access decision; never embed secrets in static assets.
- Large GRIB/HDF5 ingestion requires bounded background processing. The current specifically tested ICON-EU native GRIB2/AEC reader runs in a browser worker with a six-hour initial request, strict grid/parameter/run checks and bounded caching. Preserve those limits; do not assume that arbitrary GRIB packing, models or bulk fields are supported. Keep the earlier large WASM experiment outside the default build.
- Do not select a framework, database, hosting provider, paid subscription or project licence merely to fill an empty file. Record the concrete reason and decision status.
- Respect source-specific attribution and redistribution rights. Public display does not establish an open API or permission to rehost images and datasets.
- Open-Meteo's free hosted service is used for this evaluation under its applicable terms; the project's own licence remains an owner decision. Do not represent it as configured professional/commercial production access. Recheck provider access terms before that transition.
- Keep private account details, API keys, signed URLs, tokens and raw sensitive logs out of this public repository. Use an example environment file with placeholders when configuration becomes necessary.
- Use the GitHub connector when the user requests it. Preserve the existing branch head and use non-forced or guarded ref updates; do not reset history to resolve a conflict.

## Required iteration practice

Owner instruction, 2026-11-01: before each substantial iteration check all three studies—pilot needs, interface references and data sources—and connect the chosen change to them. Refine UX alongside functionality; preserve the agreed information depth. Record any relevant current-source recheck separately from rereading the studies.

Every final progress report must explicitly state whether the whole agreed project is complete. Distinguish finishing an iteration from finishing the project, list the material remaining work and state unverified output or operational checks honestly. Do not describe research proposals as owner-approved requirements or claim complete delivery merely because tests/deployment passed.

Owner instruction, 2026-11-01: continue through the whole buildable backlog and verification rather than ending after a feature checkpoint. Stop only at a concrete dependency requiring access or an owner/pilot decision; name it precisely and leave implementation, documentation and publication reviewable. Read the [release checklist](docs/release-checklist.md) for the current boundary.

## Validation and completion

For documentation changes, run `python3 scripts/check_docs.py` and `git diff --check` when a local Git checkout is available. Check links, terminology, proposal status and dated claims. Network source checks are deliberate research actions, not part of routine CI.

For application changes, run `npm test` and `npm run build`. Use `npm run dev` for local browser inspection. The tests use Node.js and Python standard-library tooling; no dependency installation is needed. Prioritise tests for report validity, unit and vertical-reference conversion, time boundaries, source switching, missing data and provider failure. Do not create tests that only repeat the implementation. Keep live connectivity checks separate from deterministic tests, and record the actual payload, browser result and deployment state supporting any integration claim.

Report what changed, what was checked and any remaining material limitation. Distinguish local preparation, a committed change, a deployed website and a verified live integration. Do not claim a deployment or official operational approval that has not happened.

## Additional browser products · v0.7

- Keep processed ClearToFly CEILING in ft AGL separate from native ICON-EU m MSL and the main forecast. Each sample retains its own advertised RUC/D2/EU model and explicit run evidence. Provider reference/publication time is not a model run; unknown terrain/conversion and additional reuse terms remain visible. The narrow tiled Float32/Deflate TIFF worker has two concurrent requests, an eight-field cache and six initial hourly samples.
- Local ČHMÚ map files remain user-supplied attachments. Strict PNG/JSON validation is not source authentication; preserve filename-unverified validity, null issue/retrieval and real import time through map overlays and output. No automatic freshness claim.
- The ŘLP SIGMET/AIREP image confirms display only; it never upgrades structured warning coverage. Frozen output retains an online link, not remote auto-loading pixels. Hosín’s local station link does not become a METAR/TAF or an unauthorized Weathercloud adapter.

## Evidence-first workspace · v0.8

Read [decision 0017](docs/decisions/0017-evidence-first-workspace.md) and the [dated UI/UX review](docs/design-review-2026-11-02.md) for the current hierarchy. Keep critical ceiling evidence before detailed station cards; retain every core graph and original report. Parameter colours identify fields, solid/dashed strokes identify models, and both models need visible exact selected readings. Missing coverage is not stale transport. Station inspection must not change the selected point; use the explicit forecast-location action. Preserve source disclosure state and focus during updates, and use actual sticky height for anchor offsets on short screens.

## Forecast recovery · v0.8.1

Follow [decision 0018](docs/decisions/0018-forecast-failure-recovery.md): at most two same-query attempts within one total deadline; no quota/invalid-data retries or hidden model substitution. Shared-client 429 pauses cover models/points/forced calls, and waiting retries must recheck newly reported pauses. Render main/comparison independently, keep output gated while either is pending, retain only genuine same-context data with original clocks, and never count cancelled monitor work as a successful refresh.
