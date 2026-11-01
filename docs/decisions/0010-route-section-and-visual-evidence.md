# 0010 · Route sections and licensed visual evidence

Date: 2026-11-01. Status: implemented and published; source, deployment and live verification evidence are recorded in the deployment guide.

## Context and three-study check

The owner directed work to continue through the buildable backlog rather than ending after each increment. This decision completes the remaining route/terrain and camera/chart implementation in the static evaluation scope. It does not assert professional access or pilot acceptance.

| Evidence | Consequence |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Preserve regional observations, terrain-sensitive context, original graphical products and a shareable record. A camera is evidence from one location, not an estimate of the whole route. |
| [Interface references](../research/interface-references.md) | Retain visible model/time/location controls and aligned detailed graphs. Make original-resolution imagery one action away; keep optional route setup separate from the main viewing time. |
| [Data sources](../data/sources.md) | Use only specifically verified ČHMÚ-owned cameras, licensed website charts and ČÚZK DMR 5G. Preserve unknown issue/survey times and distinct vertical datums. |

## Choice

A route section samples the explicit primary forecast model at up to 17 positions, including the route nodes, and each position's planned passage time. Great-circle position and planned time are interpolated along direct legs; weather is not interpolated between samples. Up to two forecast requests run concurrently. A rate-limit response stops queued work; changing geometry, timing or model invalidates the previous section. The optional section starts with one explicit load action, then follows route/model edits and the existing route weather refresh cycle. A manual route/global refresh forces new forecast requests; unchanged terrain retains its genuine earlier retrieval time. Existing point comparison remains available without loading the section.

Three scatter sections show wind, temperature and RH at the six qualified pressure levels. Numbers use actual distance and MSL heights. Provider-interpolated levels and below-API-terrain masks remain identified. ECMWF's unsupported profile is not supplied from another model. RH is not cloud or icing.

Terrain uses ČÚZK DMR 5G ImageServer `identify`, raw raster values, WGS84 multipoints in serial batches of 64 and at most 257 samples. ArcGIS returns a root identify object for a single-point batch and a `results` array for multiple points. Responses must identify vertical EPSG:8357. Missing or malformed samples remain gaps. Heights are **metres Bpv / Baltic 1957**, in a separate panel from forecast MSL. The 2 m output raster is not the profile's sample interval, accuracy, terrain edition or obstacle completeness. No clearance or safe-altitude calculation is made. Same-geometry reuse retains the original retrieval time; metadata supplies no per-point survey date.

A deployment collector includes only three verified ČHMÚ-authored cameras: České Budějovice–Rožnov, Churáňov and Kocelovice. It uses the advertised UTC timeline frame and checks that the image URL encodes that same time. It validates JPEG dimensions and bytes. EXIF times, map thumbnails and cameras with unverified ownership are excluded. Real cached frames retain their original observation/retrieval times and explicit stale state after failure.

A second collector binds SWL metadata to its image using stable before/after issue metadata and the image API's issue description. The low-cloud layer uses the provider's explicit EPSG:3857 bounds and advertised three-hour time inventory; missing frames remain missing. Low-cloud issuance is **unknown**, not inferred from the beginning of the timeline or forecast split. The source's cloudy/clear/no-data colours and original heights require its legend. This product remains independent of the selected main model.

The low-cloud image can overlay the existing map; activation turns observed radar off. Automatic time updates never scroll the page. Original-resolution camera/chart inspection uses one native dialog. Full briefings capture three JPEGs and the relevant SWL/low-cloud PNGs inline, retaining their provenance and source-review warnings. Failed image capture becomes an explicit unavailable state. Image-rich snapshots exceeded the previous localStorage budget in browser QA. The archive now uses atomic IndexedDB storage with up to ten records / 20 MB serialized data, preserves legacy snapshots through one-time copying (explicit deletion also removes the matching legacy copy), and retains the 5 MB legacy path when IndexedDB is absent. Write/quota failures preserve older records and leave the new preview available for download. Compact METAR/TAF output remains a report pack. The existing astronomy calculation also supplies a 48-hour sun/moon altitude graph at 30-minute intervals from the selected UTC day, with a labelled civil −6° solar reference; it does not model the terrain horizon or actual ground illumination.

## Primary-source recheck · 2026-11-01

- [ČHMÚ website terms](https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti) explicitly license products available on its website under CC BY 4.0. This is not a blanket grant for third-party cameras or the separate SWIM service.
- [Camera directory](https://www.chmi.cz/namerena-data/webkamery), station pages [Churáňov](https://www.chmi.cz/w/c1chur01-churanov), [České Budějovice–Rožnov](https://www.chmi.cz/w/c2cbud01-ceske-budejovice-roznov), [Kocelovice](https://www.chmi.cz/w/c1koce01-kocelovice), the [station-network presentation](https://intranet.chmi.cz/files/portal/docs/reditel/SIS/prezentace_a_vyuka/METEOROLOGIE/02_meteo_mereni.pdf), and actual ČHMÚ-logo camera frames corroborate the narrow allowlist. Direction and coordinates are attached to each image.
- [Camera timeline example](https://data-provider.chmi.cz/api/playableImages/init/web-kamery/churanov). Image responses contain base64 JPEG in JSON; CORS does not support the Pages origin, so collection happens at deployment.
- [SWL page](https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa), [SWL metadata](https://data-provider.chmi.cz/api/data/txtf/letectvi.cr-swl/), [SWL image](https://data-provider.chmi.cz/api/image/data/predpovedi.cr.swl/), [low-cloud page](https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti) and [low-cloud configuration](https://data-provider.chmi.cz/api/map/init/letectvi-cz.Oblacnost). These website endpoints are operationally discovered interfaces, not contracted/versioned API guarantees. SWL and low-cloud legends use hundreds of feet AMSL; SWL image times are UTC.
- [DMR service metadata](https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer?f=pjson), [ArcGIS identify documentation](https://developers.arcgis.com/rest/services-reference/enterprise/identify-image-service/), [ČÚZK open data](https://ags.cuzk.cz/opendata/) and [network-service terms](https://cuzk.gov.cz/Predpisy/Podminky-poskytovani-prostor-dat-a-sitovych-sluzeb/Podminky-poskytovani-sitovych-sluzeb-CUZK.aspx). Actual point samples: Planá 419.718 m Bpv; Kvilda 1062.47 m Bpv. Requests from the Pages origin received a matching CORS allow-origin. Server software version is not terrain edition.

## Consequences and acceptance

The current provider sites/metadata and all three studies have been rechecked. Deterministic tests cover time binding, source/datum mismatch, rate limits, cache provenance, missing frames, path/geometry validation and frozen output. Actual collection returned all three cameras, one SWL and 15 low-cloud images; other advertised slots remained unavailable. Browser and deployment evidence are recorded after verification, not inferred from collector success.

External gates remain professional forecast access, authorized aeronautical redistribution, the owner's project licence choice, intended-pilot acceptance and target-browser native output checks. The release checklist distinguishes these from completed engineering work. The complete professional project is not declared finished by this decision.
