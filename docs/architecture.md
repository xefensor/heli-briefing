# Architecture and runtime constraint

**Status: broader architecture proposed; static implementation exists.** [Decision 0004](decisions/0004-github-pages-first-build.md) records the current browser-module application and GitHub Pages host. [Decision 0005](decisions/0005-complete-briefing-data.md) records the next data and briefing capabilities. The responsibilities below also cover future private-provider access, route processing and storage; their presence does not mean those services have been implemented.

**Owner requirement · 2 November 2026:** use an ordinary browser with no extension, native app, project-operated data service/proxy or build-time weather collection. The backend responsibilities below are historical proposals and do not authorize that architecture. Existing v0.4 still uses snapshots. [Browser-only feasibility](browser-only-feasibility-2026-11-02.md) records the tested direct-source prototype and unresolved products; it is not completed production conversion.

## Historical proposed responsibilities

| Component | Responsibility |
| --- | --- |
| Provider adapters | Retrieve each source through its documented interface; preserve original payload and provenance when permitted. |
| Background ingestion | Process regional model files, radar grids and other large datasets once per new product or model run. |
| Normalisation | Decode units and timestamps, validate report status, map parameter definitions and produce capability metadata. |
| Storage and cache | Retain bounded, timestamped snapshots, source metadata and derived point/route results under the source's reuse rules. |
| Application API | Serve a consistent request contract for location, optional route, selected model and selected time; expose partial availability. |
| Briefing interface | Coordinate maps, plots and reports while keeping observed, forecast and calculated products identifiable. |

Separate background ingestion from interactive requests. A large regional GRIB or HDF5 file should not be downloaded and decoded for each map interaction. Direct-provider ingestion gives control over fields and run metadata; an aggregator can reduce development effort for point forecasts. Either path needs explicit provenance and capability handling.

## Product identity

Keep these identities separate:

- Provider, such as ČHMÚ, DWD or ECMWF.
- Product, such as METAR, ALADIN visibility, ICON ceiling or radar reflectivity.
- Model and domain, where applicable.
- Model run, where provided.
- Parameter definition, including units, level and temporal statistic.

A provider selector, forecast-model selector, map-layer selector and saved view preset perform different jobs. Their controls may sit together, but the API must not treat them as interchangeable names for one source.

## Minimum metadata

| Field group | Required meaning |
| --- | --- |
| Identity | Provider, product, model/domain where applicable, and original station or grid identity. |
| Time | Observation, issue, model-run, validity and retrieval times as separate values. Unknown values remain unknown. |
| Space | Requested coordinates, source coordinates/grid cell, site and model elevation, horizontal coverage and resolution where available. |
| Vertical reference | AGL, AMSL/MSL, station-relative or pressure level, including any conversion method and model-terrain dependency. |
| Parameter | Original and displayed units, definition, accumulation/averaging/minimum/maximum interval, and native/derived/interpolated status when known. |
| Availability | Available, missing, outside domain, outside forecast horizon, stale, cancelled, invalid or temporarily failed, with a meaningful reason. |
| Provenance | Source reference, attribution and transformation history sufficient to explain the displayed value. |

Raw data must retain enough context to reproduce transformations. Keep raw payloads only when licensing and retention rules permit; do not invent an unrestricted archive.

## Forecast selection

Use explicit models for side-by-side comparisons. A seamless forecast that changes domain or extends into another model must disclose the transition. An unsupported field remains unavailable under the selected model unless the interface explicitly names an independently sourced comparison.

The selected time coordinates charts and map layers only within each product's actual validity and cadence. Show the nearest valid observation with its own timestamp rather than relabelling it as an observation at the selected forecast instant. Route-passage forecasts are a separate calculation from a map showing every location at one selected time.

## Observations and official products

Fetch aviation reports through a backend cache and preserve the original bulletin. Select current, applicable reports by their content and validity, not solely file modification time or HTTP success. Deduplicate amended and corrected messages without discarding the evidence needed to explain their status.

Station observations, radar, satellite and cameras have different update cycles. The API should return their individual capture/observation times and permit partial success. A camera or chart failure must not make an otherwise valid forecast vanish.

NOTAM and airspace ingestion depends on a documented authorised feed. AUP/UUP planning, delayed activation history and confirmed operational status require distinct product types.

## Reliability and configuration

Batch repeated requests, coalesce identical work and respect provider limits. Use bounded timeouts, backoff and product-specific cache lifetimes. Retain the last usable snapshot only with its age and stale state visible. Refresh failures must not make an old product appear new.

Keep API keys and privileged provider access server-side. Future environment examples should contain placeholders and identify which variables are optional. The documentation stage requires no credentials.

Before selecting hosting, verify its support for background jobs, dataset size, memory, storage, network access and licensing requirements. A lightweight web runtime can serve processed results without also being the right place to ingest regional forecast files.

## Implementation gates

See the [roadmap](roadmap.md). Prove a representative Czech location and route can retrieve and display real values, timestamps, missing states and vertical references before committing the interface to a promised data view. Select a stack around these proven needs.
