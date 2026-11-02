# Architecture and runtime constraint

**Current implementation: ordinary-browser runtime, v0.7.** [Decision 0013](decisions/0013-direct-browser-integration.md) implements the owner-confirmed target: GitHub Pages hosts code/assets, and the browser requests compatible data directly. No extension, native app, project data backend/proxy or build-time weather collector is required.

[Decision 0014](decisions/0014-browser-source-gap-recovery.md) adds direct SWL display and an explicitly identified report/history supplement. [Decision 0015](decisions/0015-native-browser-recovery.md) subsequently adds original camera images and the narrow native JavaScript decoder in a persistent worker; the earlier WASM experiment remains separate. [Decision 0016](decisions/0016-further-browser-source-recovery.md) adds warning-map display, strict local original-map attachment and an independent processed-AGL worker.

## Current data path

| Component | Current responsibility |
| --- | --- |
| Forecast/terrain adapters | Direct bounded Open-Meteo and ČÚZK requests with explicit model, time, datum and missing values. |
| Aviation adapter | Direct allowlisted ČHMÚ SWIM TAC catalogue/files plus two bounded MET Norway XML requests for missing rows and real archive history; original provider/date identities and incomplete SIGMET coverage. |
| Local report cache | At most 750 kB / 400 genuine observations over twelve hours. Actual source-archive and browser observations; restored reports remain unconfirmed until refreshed, with no invented history. |
| Satellite adapter | Direct EUMETSAT capabilities and actual advertised GeoColour frame, bounded validated PNG bytes and retained original image time. |
| Radar adapter | Normal image loads confirm candidate UTC frames. Four-image current check; up to 24 observed frames on playback. No CORS pixel read or false offline image capture. |
| Camera/maps/ceiling | Original ČHMÚ images through bounded normal In-počasí / Ventusky image loads, municipal viewer on request and original SWL through ŘLP image loading. Camera exposure time remains unverified; frozen output keeps links. Native ICON-EU CEILING uses a bounded worker, actual same-grid companions and hourly files, with real point/region values captured offline. Automatic original low-cloud and direct native ICON-D2 MSL remain unsupported. No source or meteorological quantity is silently substituted. |
| Warning image | Direct ŘLP SIGMET/AIREP image-load confirmation; normalized issue/validity and complete warning scope stay unknown. Offline output keeps a source link only. |
| Local low-cloud files | Strict local PNG/JSON, original UTC-slot filename but unverified provenance/time, actual import time and no auto-refresh. Shared-time selection, optional map overlay and one embedded output frame; no network collection. |
| Processed ceiling AGL | Independent ClearToFly catalogue/GeoTIFF worker with explicit per-frame RUC/D2/EU runs, ft AGL, containing raster pixel and sparse actual centres. Two requests and eight cached fields; unknown terrain/conversion/extra reuse terms remain explicit. |
| Browser workspace/output | Existing graphs, controls, route, astronomy, local notes/archive and frozen HTML/text; all source and export limitations remain visible. |
| Static build/deploy | Copy/version code/assets only. Exclude all weather snapshots, publish on code changes or manual dispatch; no data schedule or ingestion dependencies. |

The [source feasibility record](browser-only-feasibility-2026-11-02.md) retains actual endpoint and CORS/browser evidence. Complete station/time history, current machine-readable SIGMET coverage, automatic original low-cloud access and direct native-D2 MSL parity remain source dependencies. The native ICON-EU archive is now read by a tested JavaScript decoder, with bounded initial/expanded hourly sampling and original field clocks. The historical WASM proof is not loaded. Native download/PDF and intended-pilot acceptance remain separately unverified.

## Historical proposed responsibilities

The following describes the earlier broader proposal, not authorization to restore a backend under the current requirement.


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
