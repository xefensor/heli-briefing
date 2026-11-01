# Working on Heli Briefing

## Read before changing files

Start with [README.md](README.md), the [documentation index](docs/README.md) and [product brief](docs/product-brief.md). Read the [design document](docs/design.md) for interface work and both [data sources](docs/data/sources.md) and [data integrity](docs/data/integrity.md) for data work. Check the [decision register](docs/decisions/README.md) before treating a proposal as settled.

The repository contains research and a first evaluation implementation in `web/`: browser-native JavaScript modules, HTML, CSS and SVG charts, with no browser package dependencies. Node.js 24 builds static output in `dist/`; Python collects aviation reports and a separate isolated ecCodes environment processes native DWD cloud heights. The evaluation version is [published on GitHub Pages](https://xefensor.github.io/heli-briefing/), with build/deployment and live report/radar snapshot loading confirmed on 2026-11-01. Read [deployment](docs/deployment.md) and [decision 0004](docs/decisions/0004-github-pages-first-build.md) for the source commit, workflow evidence and implemented hosting/data path. Distinguish this publication result from comprehensive browser checks and validated pilot workflows.

Use the three research tracks—[pilot needs](docs/research/pilot-needs.md), [aviation interfaces](docs/research/interface-references.md) and [data sources](docs/data/sources.md)—to develop the product. Read the [original-site inventory](docs/research/original-site.md) for contextual evidence and defects; its feature set, section order and controls are not an accepted specification. Do not import a rejected prototype.

## Product requirements

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
- Maintain provider adapters and clear capability metadata. The first static version uses browser forecast requests and a deployment-time report collector; future private/commercial access requires a suitable server-side adapter or ingestion service. Keep provider credentials and proprietary access on the server; never embed keys in static assets.
- Large GRIB/HDF5 ingestion requires a suitable background process. Do not assume browser code or a small request-time function can decode an entire regional model on demand.
- Do not select a framework, database, hosting provider, paid subscription or project licence merely to fill an empty file. Record the concrete reason and decision status.
- Respect source-specific attribution and redistribution rights. Public display does not establish an open API or permission to rehost images and datasets.
- Open-Meteo's free hosted service supports this open-source evaluation under its applicable terms. Do not represent it as configured professional/commercial production access. Recheck provider access terms before that transition.
- Keep private account details, API keys, signed URLs, tokens and raw sensitive logs out of this public repository. Use an example environment file with placeholders when configuration becomes necessary.
- Use the GitHub connector when the user requests it. Preserve the existing branch head and use non-forced or guarded ref updates; do not reset history to resolve a conflict.

## Validation and completion

For documentation changes, run `python3 scripts/check_docs.py` and `git diff --check` when a local Git checkout is available. Check links, terminology, proposal status and dated claims. Network source checks are deliberate research actions, not part of routine CI.

For application changes, run `npm test` and `npm run build`. Use `npm run dev` for local browser inspection. The tests use Node.js and Python standard-library tooling; no dependency installation is needed. Prioritise tests for report validity, unit and vertical-reference conversion, time boundaries, source switching, missing data and provider failure. Do not create tests that only repeat the implementation. Keep live connectivity checks separate from deterministic tests, and record the actual payload, browser result and deployment state supporting any integration claim.

Report what changed, what was checked and any remaining material limitation. Distinguish local preparation, a committed change, a deployed website and a verified live integration. Do not claim a deployment or official operational approval that has not happened.
