# Data sources and access

[Documentation index](../README.md) · [Pilot-needs evidence](../research/pilot-needs.md) · [Interface references](../research/interface-references.md)

Last verified: **2026-11-01**. This is a research catalog, not a statement that any integration has been implemented or approved for redistribution. It covers Czechia, especially South Bohemia, with regional context for Central Europe. See [data integrity](integrity.md) for interpretation and handling rules.

Three evidence labels apply throughout:

- **Documented:** a provider describes a product, interface, or condition in the linked source.
- **Sampled:** a read-only request returned the described result on the verification date; this is neither a service guarantee nor an accuracy evaluation.
- **Proposed:** a choice for a future implementation, subject to validation, access terms, and operational scope.

## 1. Forecast models: choose capabilities, not a universal winner

No research here establishes one universally most accurate model for helicopter operations. Grid spacing alone does not establish local accuracy, especially for fog, low cloud, convection, or complex terrain.

| Model / distribution | Documented coverage, timing and resolution | Relevant capability and caveat |
| --- | --- | --- |
| ČHMÚ ALADIN | Central European physical model approximately 2.325 km; hourly public output, around 72 hours, runs every six hours. | Local surface fields and pressure-level profiles. The product described as “CZ 1 km” is a regular output grid, not evidence of a separate physical 1 km forecast model. |
| DWD ICON-D2 | Native spacing approximately 2.1 km; 48-hour forecast, runs every three hours. | Detailed regional short-range output; limited domain. Raw DWD includes a model ceiling diagnostic. |
| DWD ICON-EU | Native spacing approximately 6.5 km; main 00/06/12/18 UTC runs reach 120 hours, intermediate runs 51 hours. | Wider regional coverage and a longer outlook; run-dependent horizon must survive normalization. |
| ECMWF IFS HRES through Open-Meteo | Global 9 km distribution, runs every six hours, up to 15 days. | Surface/cloud/visibility fields; this specific API model does not expose pressure-level fields. |
| ECMWF IFS 0.25° through Open-Meteo | Global approximately 25 km distribution, runs every six hours, up to 15 days. | Pressure-level wind and geopotential available; it is a different distribution from HRES 9 km. |

**Proposed:** evaluate ALADIN as the local forecast candidate, ICON-D2 as an independent short-range comparison, ICON-EU for wider regional travel, and ECMWF for broader outlooks. Preserve the selected model and its actual capabilities. Do not silently combine one model's visibility with another model's profile under one model label.

### ČHMÚ ALADIN

Primary discovery points are [ČHMÚ Open Data](https://opendata.chmi.cz/) and the aggregator's [ALADIN API documentation](https://open-meteo.com/en/docs/chmi-api). Open-Meteo documents a Central Europe domain with 17 pressure levels and a Czech output domain. Its “seamless” selection chooses domains automatically and can extend forecasts with ECMWF. That convenience requires explicit provenance if used.

Direct products are organised under [Lambert 2.3 km](https://opendata.chmi.cz/meteorology/weather/nwp_aladin/Lambert_2.3km/) and [CZ output grid](https://opendata.chmi.cz/meteorology/weather/nwp_aladin/CZ_1km/), with run folders `00/06/12/18` and parameter-specific compressed GRIB files. The [official model description](https://www.chmi.cz/predpoved-pocasi/aladin/vice-o-modelu-aladin) states 2.325 km physical spacing and 87 vertical levels. The [Lambert dataset record](https://geoportal.gov.cz/php/micka/record/full/665ee7b7-9b0c-4b24-a736-393e9ec0a8017c) states a 72-hour horizon and CC BY 4.0 reuse. The [published field inventory](https://opendata.chmi.cz/meteorology/weather/nwp_aladin/Popis_obsahu.xlsx) distinguishes the post-processed Czech output grid from the native forecast and defines the fields.

The physical-model/output-grid distinction corrects an earlier overstatement: a finer delivered grid can be a remapping of a coarser model. Documentation and UI must not advertise the Czech output as a physical 1 km model without a separate provider statement establishing that.

Raw ČHMÚ research identified separate visibility diagnostics associated with fog/cloud and precipitation, including `CLS_VISICLD` and `CLS_VISIPRE`. They must retain their definitions and hourly-minimum semantics. A generic aggregator `visibility` field does not prove which raw diagnostic, combination, or post-processing it represents. Confirm that mapping before describing the two as equivalent.

### DWD raw forecast data

Start with the [Open Data README](https://opendata.dwd.de/README.txt) and [ICON database manual](https://www.dwd.de/DWD/forschung/nwv/fepub/icon_database_main.pdf). The manual documents model domains, parameters, forecast steps and reference times. The [DWD reuse conditions, price-list Appendix 2](https://www.dwd.de/SharedDocs/downloads/DE/allgemein/preisliste_2024.pdf?__blob=publicationFile&v=21) describe reuse of free services under CC BY 4.0 with source acknowledgement. Check the current conditions when integrating; a public directory does not remove attribution duties.

The documented rotated ICON-D2 output rectangle includes LKCS and LKHS. Applying the manual's coordinate transformation places a representative far-eastern Czech point outside it. This is a calculation against that documented output grid, not verification of every point in the current native-grid mask. **Do not promise ICON-D2 coverage for all Czechia.**

Raw ceiling directories are independently discoverable:

- [ICON-D2 CEILING](https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/CEILING/)
- [ICON-EU CEILING](https://opendata.dwd.de/weather/nwp/v1/m/icon-eu/p/CEILING/)

DWD's [ICON-D2 technical description, §6.1, printed page 47](https://rcccm.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon_d2/icon_d2_dbbeschr_aktuell.pdf?nn=16102&view=nasPublication) defines `CEILING` as the height **in metres above mean sea level** where large-scale/subscale cloud coverage first exceeds 50% looking upward from the ground, excluding the convective contribution. It is not cloud-cover percentage, convective cloud base, an observation, or an interchangeable METAR ceiling. A height above model ground requires corresponding model terrain (`HSURF`); local terrain can differ.

Open-Meteo's [DWD API documentation](https://open-meteo.com/en/docs/dwd-api) announces migration to native grids after **30 November 2026** and withdrawal of visibility. It links a [DWD September 2026 announcement](https://www.dwd.de/DE/leistungen/opendata/neuigkeiten/opendata_september2026_1.html); the announcement itself was not directly readable during this research. Treat the dated withdrawal as Open-Meteo's published notice. Visibility was still returned by the legacy API sample below; it is not a durable capability to assume.

### Open-Meteo access and field matrix

Official references: [DWD API](https://open-meteo.com/en/docs/dwd-api), [ECMWF API](https://open-meteo.com/en/docs/ecmwf-api), [model updates](https://open-meteo.com/en/docs/model-updates), [Single Runs API](https://open-meteo.com/en/docs/single-runs-api), [terms](https://open-meteo.com/en/terms).

Relevant endpoints:

```text
https://api.open-meteo.com/v1/dwd-icon
https://api.open-meteo.com/v1/forecast
https://single-runs-api.open-meteo.com/v1/forecast
```

**Sampled:** at public coordinates 48.975° N, 14.475° E near České Budějovice, on 2026-11-01 around 13:35 UTC, requests used `forecast_days=3`, `timeformat=unixtime`, and the same seven hourly fields. Counts below are non-null values out of 72 requested calendar hours, including past hours that day.

| Explicit model identifier | Visibility | Low/mid/high cloud | 925 hPa wind / geopotential | 10 m wind |
| --- | --- | --- | --- | --- |
| `icon_d2` | 61/72 | 61/72 each | 61/72 each | 61/72 |
| `chmi_aladin_seamless` | 72/72 | 72/72 each | 72/72 each | 72/72 |
| `ecmwf_ifs` | 72/72 | 72/72 each | 0/72 each | 72/72 |
| `ecmwf_ifs025` | 0/72 | 72/72 each | 72/72 each | 72/72 |

The ICON tail was null beyond available coverage; unsupported ECMWF fields were null with an `undefined` unit. A successful HTTP response therefore does not establish field availability. This sample establishes neither model accuracy nor future uptime. The precise ALADIN “seamless” source composition also requires provenance inspection.

Do not call the returned D2 925 hPa values native output. The documented native level inventory lacks 925 hPa; this research did not independently establish the field-specific derivation of the returned wind and height. Open-Meteo's pressure-level cloud-cover documentation describes derivation/interpolation, which must not be stretched into a verified guarantee for every variable.

The DWD API also lists wind at 10, 80, 120 and 180 metres, plus pressure-level wind and geopotential. Treat these as distinct vertical products and check each selected model's returned coverage. Pressure-level heights are MSL, not fixed heights above the landing location.

The ordinary forecast response had no model-run timestamp. `generationtime_ms` is processing duration, not issue time. The normal API stitches runs; a Single Runs request supplies `run=` in UTC and preserves a particular initialization. Initialization, publication, retrieval and forecast-valid time remain distinct. Open-Meteo also documents eventual consistency across its servers.

Data licensing and hosted-service access are separate. Open-Meteo's free hosted API is for non-commercial use within published limits, currently below 10,000 calls/day, 5,000/hour and 600/minute. Commercial/promotional applications require the applicable paid service. Respect attribution and limits; do not use alternate egress to work around a 429 response.

## 2. Aviation observations, forecasts and warnings

### ČHMÚ SWIM

Sources: [service information](https://swim.chmi.cz/info.php), [June 2026 API reference](https://swim.chmi.cz/SWIM_API_reference.pdf), [endpoint](https://swim.chmi.cz/api.php).

Documented access includes `action=list` for file metadata and requests such as:

```text
https://swim.chmi.cz/api.php?action=get&file=LKPR_METAR.txt&format=txt
```

The sampled access required no authentication. A latest file can still contain expired forecasts, cancellation (`CNL`), missing-report (`NIL`) content, or stale XML while a text counterpart is newer. Read internal issue/validity times rather than trusting filename or modification time. No explicit SWIM redistribution licence was established; do not apply a blanket ČHMÚ open-data licence to it.

The June 2026 API document also contains a product-code discrepancy: samples of `FTCZ31` and `FTCZ32` contained TAF bulletins, despite unrelated descriptions in the reference. Discover files through metadata and verify their contents. The [ČHMÚ user-group minutes from November 2022](https://www.chmi.cz/files/portal/docs/meteo/olm/Annual/Zapis_RU_3_11%202022_final.pdf) record GAMET's discontinuation at the end of 2022 and replacement by SWL; do not infer a current GAMET feed from the stale description. The [SWL chart](https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa) is a separate graphical product, not a structured field returned by this API. The [low-cloud chart](https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti) shows BKN/OVC areas with bases in hundreds of feet AMSL.

For observed regional trends, [ČHMÚ station documentation](https://opendata.chmi.cz/meteorology/climate/Klimatologicka_data_popis.pdf) describes daily JSON files such as `10m-{WSI}-{YYYYMMDD}.json` under [current station data](https://opendata.chmi.cz/meteorology/climate/now/data/). Ten-minute sampling does not imply ten-minute publication: the documented files are published hourly. Read station metadata, parameter units and quality flags; an updated file can contain missing or substantially older values. Visibility codes must be decoded rather than interpreted directly as metres.

### NOAA Aviation Weather Center

The [AWC API documentation](https://aviationweather.gov/data/api/) covers endpoints including:

```text
https://aviationweather.gov/api/data/metar
https://aviationweather.gov/api/data/taf
https://aviationweather.gov/api/data/sigmet
```

AWC documents no browser CORS support, request/response limits including 100 requests/minute and 400 entries, and server access identification requirements. A backend adapter is the appropriate integration path, with bounded station/product requests. The unified SIGMET endpoint is documented in the October 2026 API changes. METAR/TAF/SIGMET coverage is international; PIREPs are primarily US/North Atlantic and G-AIRMETs cover the continental US, not equivalent Czech coverage. HTTP 204 can legitimately mean no available data.

A sample querying LKCS, LKHS and LKPR returned only LKPR. This means neither that the missing stations never report nor that a nearby report is local truth. Preserve raw reports and station identities; report an absence honestly.

## 3. Radar, satellite and cameras

- **ČHMÚ radar:** the [product description](https://opendata.chmi.cz/meteorology/weather/radar/radar_description_en.pdf) describes composites named `pseudocappi2km` and `maxz`, with approximately 1 km spatial output, five-minute updates, PNG/HDF5 products and EPSG:3857 image mapping. PNG discovery directories include [pseudo-CAPPI](https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/) and [maximum reflectivity](https://opendata.chmi.cz/meteorology/weather/radar/composite/maxz/png/). Its [catalogue record](https://geoportal.gov.cz/php/micka/record/basic/665ef4d1-b48c-405e-aaa4-394591c0a8017c) states CC BY 4.0. Verified open extrapolations cover +10 to +60 minutes; do not infer a 90-minute open forecast from a viewer. Lightning has separate commercial conditions.
- **European OPERA:** [Open Radar Data access documentation](https://eumetnet.github.io/openradardata-documentation/2-ORD-API-discovering-and-accessing-data/) describes reflectivity, rain rate and one-hour accumulation in COG/ODIM, CC BY 4.0, a rolling 24-hour cache, optional keys and anonymous access limits. Composite coverage gaps and differing product meanings must remain visible.
- **EUMETSAT satellite:** [EUMETView resources](https://user.eumetsat.int/data-access/eumetview/resources) and [WMS endpoint](https://view.eumetsat.int/geoserver/wms). A capabilities sample listed `mtg_fd:rgb_fog`, `mtg_fd:rgb_cloudphase`, and `mtg_fd:rgb_cloudtype`. These are image/composite products, not direct measurements of local ceiling or visibility. Access and redistribution conditions are product-specific.
- **Webcams:** [Windy Webcams API documentation](https://api.windy.com/webcams/docs) and [terms](https://api.windy.com/webcams/terms) describe keyed access, expiring image URLs, attribution/linking, and images obtained through the API. A camera visible on a public website does not establish permission to hotlink, archive or redistribute it. Direct-camera rights remain unresolved unless documented separately.

## 4. Terrain, astronomy and aeronautical information

- **Terrain:** [ČÚZK Open Data](https://ags.cuzk.cz/opendata/) includes DMR 5G under CC BY 4.0. It is terrain, not a complete obstacle database or a clearance guarantee. Retain dataset version, sampling scale and vertical reference.
- **Astronomy:** [US Naval Observatory API](https://aa.usno.navy.mil/data/api.html). Daily lunar fraction is referenced to local noon; it must not be described as the fraction at an arbitrary selected instant. Exact-instant calculations need a validated local algorithm. Lunar fraction is not ground illumination, which also depends on geometry and weather.
- **ŘLP/AIM:** [terms of use](https://aim.rlp.cz/?lang=cz&p=podminky-uziti) restrict redistribution for commercial and non-commercial use without written consent. [AUP/UUP planning products](https://aim.rlp.cz/?lang=cz&p=aup-uup) and [area activation information](https://aim.rlp.cz/?lang=cz&p=act-area) have different purposes; sampled activation JSON could be one to two days late. Do not present planning or stale activation data as current airspace status.
- **NOTAM:** no unrestricted operational NOTAM API was verified. [EUROCONTROL EAD](https://www.eurocontrol.int/service/european-ais-database) is a professional access path to investigate; EAD Basic should not be represented as an operational redistribution API.

Official [ŘLP datasets](https://aim.rlp.cz/?lang=cz&p=datasets) distinguish terrain and obstacle products, while the [VFR manual](https://aim.rlp.cz/vfrmanual/actual/gen_1_cz.html) includes heliport information. A HEMS base and an airport in the same city are distinct locations; mapped landing sites do not imply general landing availability. An obstacle list is not complete coverage of every low-level wire or obstruction. Reuse permissions remain separate from technical download access.

EUROCONTROL's [October 2026 eEAD transition update](https://www.eurocontrol.int/news/eurocontrol-advances-digital-transformation-delivering-major-eead-transition-milestone-part) describes an ongoing service transition. Seek current onboarding and interface specifications rather than assuming a legacy-only integration. Public AUP/UUP XML supplies planned times and area identifiers, not a complete live-status or geometry service.

## 5. Other service options and exclusions

- **Windy Point Forecast:** the [official pricing and access page](https://api.windy.com/point-forecast/pricing), checked on 2026-11-01, states that the free testing tier returns randomly shuffled and slightly modified data. It is not a source of real briefing values. The paid production service was listed at EUR 990/year and excludes ECMWF; recheck pricing and terms before a purchase. This is separate from Windy's map and camera APIs.
- **Meteomatics:** its [cloud parameter documentation](https://www.meteomatics.com/en/api/available-parameters/weather-parameter/clouds/) distinguishes `ceiling_height_agl` from `cloud_base_agl`; [general weather parameters](https://www.meteomatics.com/en/api/available-parameters/weather-parameter/general-weather-state/) include visibility, and its [aviation service](https://www.meteomatics.com/en/aviation-industry/) documents altitude/route queries. It is a professional service to evaluate if reducing ingestion work justifies the agreed cost and rights. No authenticated trial or local forecast-skill advantage was established.
- **Meteoblue:** its [weather-variable documentation](https://docs.meteoblue.com/en/meteo/variables/weather-variables) and [aviation products](https://content.meteoblue.com/en/private-customers/website-help/aviation) describe visibility, profiles and aviation charts. Verify package availability, output-grid elevation and redistribution terms rather than assuming that a viewable website graph is an open machine feed.

## Maintenance

For each changed source, record the check date, product/version, relevant URL, licence, sample scope and unresolved questions. Recheck the DWD migration first. Re-run small capability samples after provider changes; keep samples separate from claims about accuracy, reliability, or implemented behavior.


## Implemented point profile and satellite extension · 2026-11-01

See [decision 0006](../decisions/0006-point-profile-and-satellite.md) for the checked Open-Meteo pressure-level documentation, provider interpolation labels, actual payload samples and the product-specific EUMETSAT GeoColour licence. The bounded GeoColour collector preserves the advertised/requested frame time independently of retrieval. It produces a generated static snapshot with EUMETSAT/NASA credit; cameras and full route profiles remain open. Current provider documentation explicitly identifies ICON-D2 925/800 hPa as interpolation, superseding the earlier unresolved derivation note for these fields.


## Implemented route-point extension · 2026-11-01

[Decision 0009](../decisions/0009-route-point-weather.md) records the bounded point-weather route view and its separate primary-source recheck of Open-Meteo coordinates, preceding-hour gust/rain definitions and hosted-service terms. It uses the existing explicit models and native ceiling crop with user-entered passage times, per-point source metadata, at most two simultaneous route requests and honest missing coverage. It does not add continuous corridor weather, a terrain dataset or professional provider access. Current data licensing/access boundaries above remain in force.


## Route/visual-evidence completion · 2026-11-01

[Decision 0010](../decisions/0010-route-section-and-visual-evidence.md) supersedes the earlier camera/full-route implementation gaps above. It records the current primary-source checks, exact endpoints, sampled camera ownership, ČHMÚ website CC BY 4.0 grant, image-time binding and native ČÚZK Bpv terrain contract. The implementation includes three cameras and website SWL/low-cloud imagery; it does not extend that grant to third-party cameras or the separate SWIM API. Pressure-level wind/temperature/RH sections use the existing explicit forecast model; separately referenced terrain does not supply a clearance or obstacle assessment. Professional forecast access and aeronautical redistribution remain external dependencies.


## Ordinary-browser source recheck · 2026-11-02

The owner now requires runtime data in an ordinary browser without an extension, app or project-operated backend/collector. The [source feasibility record](../browser-only-feasibility-2026-11-02.md) documents actual Origin-header and browser tests, exact routes, partial coverage and export restrictions. A separate direct-source prototype is implemented; the main briefing is not yet converted.

SWIM TAC list/get currently permits CORS from Pages and supplied fresh Czech METAR/TAF alongside genuinely old cancellation/SIGMET files; do not infer current validity from a new download or combine stale XML with newer TAC. EUMETSAT capabilities/GetMap permit direct browser reading and local embedded-image output. Radar PNGs can display through Image loads, but CORS still prevents reading their pixels for offline capture. The official municipal Radnice camera actually played in a browser iframe; it is a different source/view from the three original ČHMÚ cameras and exposes no acquisition time. Original camera, SWL, low-cloud and native-ceiling parity remain unresolved. Public access/CORS is separate from redistribution rights; earlier licence/professional gates remain applicable.


## Production direct-browser integration · 2026-11-02

[Decision 0013](../decisions/0013-direct-browser-integration.md) now uses the verified direct SWIM, EUMETSAT and radar routes in the main workspace. It adds bounded local report history and the separately identified municipal viewer. The build excludes all generated weather data and runs no collectors. The source restrictions and rights in the feasibility record remain unchanged; integration does not make SWIM a complete regional warning/history service or grant new professional access. Original blocked products remain source links.


## Recovered browser sources · 2026-11-02

[Decision 0014](../decisions/0014-browser-source-gap-recovery.md) records current, bounded source checks and integration. The original ČHMÚ SWL can display as a normal PNG from its documented official distributor, `https://meteo.rlp.cz/swlmap.png`, without pixel access. Its issue/validity remain in the source header, not inferred from loading. MET Norway's official Tafmetar XML endpoint permits simple CORS requests and supplies missing Austrian reports, LKKV TAF and real initial history; the documented national-SWIM transition remains an explicit availability risk. Both providers retain independent report identities and original dates. Camera cards link the same original views on In-počasí without unsupported hotlinking or invented age.

The same decision records an actual browser fetch/decompression/decoding proof for ICON-EU CEILING through Source Cooperative. This is a different model, not restored ICON-D2. It requires a large lazy-loaded WASM decoder and production validation of the advertised native-grid route before integration. Low-cloud imagery, original embedded cameras and complete current warning coverage remain unresolved.


## Native browser recovery · 2026-11-02

[Decision 0015](../decisions/0015-native-browser-recovery.md) records the implemented pure-JavaScript native ICON-EU decoder and original camera display. The camera distributor publishes full-resolution hourly-folder JPEG paths in its actual client constants; all three were fetched at 1600 × 1200. The objects are mutable within an hour: actual modification times changed from around 11:10 to 11:40 UTC, and České Budějovice's photo clock advanced from 12:05:04 to 12:35:04 CZ. The browser confirms loading, not exposure time; the original clock and ČHMÚ credit remain intact. No application iframe, source pixels or camera-age inference is used.

Native ICON-EU CEILING, CLAT, CLON and HSURF are fetched directly from the public Source Cooperative S3 archive, checked for actual run/validity, parameter and the same grid UUID, and decoded in a worker. A narrow 7,161-byte AEC decoder replaces the historical 41 MB WASM proof. All 3,074,432 values in four real native fields matched ecCodes exactly. Six initial hours, optional extension to 24, at most two simultaneous requests and a 15-field decoded cache bound are explicit implementation limits. Model values retain m MSL and their actual nearest cell; regional graphics show actual centres and null gaps without interpolated coverage. This does not make ICON-EU into ICON-D2 or the original ČHMÚ low-cloud chart.


## Further browser recovery · 2026-11-02

[Decision 0016](../decisions/0016-further-browser-source-recovery.md) records the primary-source recheck and implemented adapters. The official ŘLP SIGMET/AIREP PNG decodes directly at 1500 × 900; original update time stays inside its UTC heading and normalized warning coverage remains incomplete. The exact ČHMÚ low-cloud frame JSON contains only PNG bytes, with no embedded time. Optional local import preserves the original UTC-slot filename as an unverified user claim, null issue/retrieval and actual local import time; selected pixels can be captured offline.

ClearToFly’s public catalogue advertises browser-readable Float32/Deflate GeoTIFFs. Its actual dated viewer labels distinguish RUC, D2 and EU runs from the separate validity-axis reference and catalogue publication. These processed raster values remain ft AGL, with the provider’s undocumented terrain/conversion and additional COG reuse terms explicitly unknown. Real raster decoding matched all 918,750 pixels against Pillow; local browser sampling separately showed RUC and D2. It does not restore direct native D2 MSL access.

The Hosín operator’s pilot page links a local Weathercloud station. The website preserves that external link as corroboration, not a METAR/TAF. Weathercloud’s FAQ provides no read API and its terms restrict third-party extraction/integration without permission; no such adapter or frame is introduced. Exact URLs and dates are in the decision.


## Forecast availability recheck · 2 November 2026

[Decision 0018](../decisions/0018-forecast-failure-recovery.md) records the reported ALADIN 503, exact-query HTTP 200 samples for all three models, the eleven null ICON-D2 trailing hours and the later actual browser 429 limitation. The three main models share Open-Meteo transport; selecting a different model does not establish independent provider failover. Query fields, model IDs, source identities and access terms were not changed. No provider-wide green status was established from its dynamic status-page shell.
