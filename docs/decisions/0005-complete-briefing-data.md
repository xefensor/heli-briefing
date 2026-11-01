# Complete the briefing data path in v0.2

Date: 2026-11-01

Status: accepted implementation scope; in progress, not yet a verified v0.2 release

## Context

The first GitHub Pages evaluation established real point forecasts, substantial coordinated charts, regional reports and timestamped radar. The next iteration completes the preparation workflow with continuing freshness information, trustworthy cloud-height evidence, report history and a frozen output for others. These are implementation choices for the existing research-informed product, not a claim that the pilot has validated the interface or every proposed feature.

## Decision

Implement the following together while retaining the existing static browser application and GitHub Pages publication path:

| Area | v0.2 behaviour |
| --- | --- |
| Monitoring | Thirty-second age ticks while active; forecasts due every ten minutes and report/radar/cloud snapshot checks every five minutes. Pause network work when hidden/offline, check on return and preserve a pinned inspection time. |
| Native cloud diagnostic | Fetch DWD ICON-D2 native `CEILING`, preserving its model/run/validity, native-grid cell positions, terrain reference and missing-value bitmap. Display it as an independent source, including when the selected point forecast is ALADIN or ECMWF. |
| Report detail | Conservative structured METAR summaries and explicit TAF change periods with raw text available; preserve unknown fields, bounds, cancellation, NIL and expiry. Add twelve hours of station-specific METAR history. |
| Radar history | Up to twenty-four observed frames spanning two hours, each with acquisition time and honest missing frames. This is observed history, not extrapolation. |
| Briefing output | Frozen HTML export of the inspected context/data and up to ten browser-local archives. Preserve source/time and missing-data context; opening a frozen export must not silently replace it with newer data. |

## Native cloud ingestion and cache

Use a bounded Python ingestion command, separate from the browser and dependency-free Node build. Pin ecCodes and its binary libraries in `requirements-clouds.txt` and install them in an isolated environment before decoding. The collector discovers the newest actual DWD run with all 0–48-hour steps, validates field identity, units, grid identity and run/validity, then crops native cell centres to the documented regional bounds. Do not substitute cloud fraction, a dew-point calculation or a neighbouring model's ceiling.

Cache the compact assembled crop under `.cache/clouds`, keyed by the actual model-run identifier and the collector/requirements hash. Reuse the same run across twenty-minute deployments; do not create a new cache solely because a workflow ran. Do not restore a different-run cache under a label implying the current run. Failed run discovery skips cache restoration and lets the collector write stale/unavailable state. Decoder installation failure remains a build failure.

The DWD diagnostic is a height in **metres MSL** where scale/sub-scale cloud fraction first exceeds 50% looking upward, excluding the convective contribution. It is not an observed ceiling or a universal local cloud base. Native missing values are undefined and do not establish clear sky. The verified source definition is on printed page 47 of the [DWD ICON-D2 database description](https://rcccm.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon_d2/icon_d2_dbbeschr_aktuell.pdf?nn=16102&view=nasPublication); the [native CEILING run listing](https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/CEILING/r/) supplies actual published runs. Source checked 2026-11-01; runtime sample and release verification must be recorded separately.

## Consequences and limits

- Frequent browser checks do not turn periodically published snapshots into live source connections. Product age and retrieval age remain distinct.
- Refreshing data must not move a deliberately selected inspection time or replace source identities. Live mode is explicit.
- TAF period summaries are an interpretation beside the original bulletin. Missing or unknown groups must not become invented conditions, and overlapping temporary/probability periods must not flatten into false certainty.
- Browser archives are local to that browser/origin and may be cleared or unavailable. They are neither a shared account nor durable server storage. Exports need no secret keys or recipient management.
- The application stays an open-source evaluation. No paid Open-Meteo or other professional production access has been configured; any private provider credential requires an appropriate server-side service.
- Unit checks, live ingestion, browser behaviour and deployment are separate evidence. Mark this release complete only after the corresponding checks pass and the deployed result is verified.

See [deployment](../deployment.md), [roadmap](../roadmap.md) and [data integrity](../data/integrity.md).

## Workflow reference

The official [actions/cache v6.1.0 release](https://github.com/actions/cache/releases/tag/v6.1.0) and [action definition](https://github.com/actions/cache/blob/v6.1.0/action.yml) were checked on 2026-11-01. The workflow pins its release commit `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`; exact run keys are used without restore-prefix fallback.
