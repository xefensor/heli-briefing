# Browser-only data · verified prototype

Checked **2 November 2026**. [Decision 0012](decisions/0012-browser-only-runtime.md) · [Data sources](data/sources.md) · [Release checklist](release-checklist.md).

## Requirement and completion boundary

The owner requires an ordinary website: no browser extension, native app, project-operated data backend/proxy or deployment-time weather collection. Static application hosting remains GitHub Pages.

This checkpoint supplies tested direct-source adapters and a runnable verification page, `web/browser-sources.html`. Open `/browser-sources.html` under `npm run dev` and click **Test browser sources**; camera playback is a separate explicit action. The static build versions that page with the application assets, and the main footer links to it. The page makes provider requests directly; the development server only serves files.

**The main briefing has not been converted in this checkpoint.** Replacing its data path immediately would lose structured foreign reports, initial historical coverage and several integrated products. Those differences are documented rather than silently removed. Existing snapshot collection is the previous implementation, not compliance with the new requirement. The prototype is not an operational weather briefing or a completed migration.

## Three-study review

| Study | Applied consequence |
| --- | --- |
| [Pilot needs](research/pilot-needs.md) | Preserve evidence depth and source age. A new camera viewpoint or reduced regional coverage must remain visible, not masquerade as the original source. |
| [Interface references](research/interface-references.md) | Keep the main workspace intact while proving direct adapters. Demonstrate actual data and original bulletins before replacing connected graphs or reports. |
| [Data sources](data/sources.md) | Check CORS with the Pages origin and then run real browser tests. Transport success, report validity, reuse rights and exportability are separate. |

## Source matrix

| Product | Verified ordinary-browser path | Remaining difference / limitation |
| --- | --- | --- |
| Existing point and route forecasts | Existing direct Open-Meteo requests. | Professional hosted-service access remains a separate gate. |
| Existing terrain and astronomy | Existing browser ČÚZK queries and local calculations. | Datum, obstacle and horizon limitations remain unchanged. |
| Czech METAR/TAF | Direct ČHMÚ MET-SWIM TAC `list`/`get`, CORS `*`. New `aviation-source.js`. | The chosen inventory lacks LKHS, LOWL and LOWW; TAF coverage is narrower. Original dated cancellation and missing station rows must remain explicit. |
| SIGMET | Direct SWIM retrieval is technically readable. | Its latest-file catalogue contained an expired October 26 LKAA message. It does not prove a complete current warning inventory or all-clear. `coverageComplete:false` is mandatory. |
| METAR history | Adapter can merge actual observations encountered by this browser over a bounded twelve-hour window. | SWIM offers no verified initial twelve-hour archive. The prototype calls it partial prospective history; a past graph cannot be invented. |
| GeoColour satellite | Direct EUMETSAT capabilities plus advertised-frame WMS GetMap, both CORS `*`. New `satellite-source.js`. | Preserve product time independently of download time. Validate actual PNG, geometry and size; a fallback can use only a preceding advertised frame. |
| Observed radar | Normal `Image` requests to documented five-minute PNG URLs. New `radar-source.js`; a frame exists only after actual image load. | No CORS pixel access: the offline snapshot may retain source/time/link, not embedded image bytes. Missing frames remain gaps; use bounded requests and lazy activation. |
| Original three ČHMÚ cameras | No compatible direct route verified. | Their timeline/frame APIs return JSON/base64 without CORS; modern source pages block external framing. No verified current raw-JPEG alternative found. |
| Municipal Radnice camera | Official České Budějovice viewer embedded successfully; actual live playback observed. Underlying HLS playlists and a real segment also returned CORS `*`. | Different viewpoint, not one of the original ČHMÚ cameras. Acquisition time is not exposed; no fabricated age or claim of offline capture. |
| Kvilda direct JPEG candidates | Owner pages link current Ski Kvilda and Šumava.eu JPEGs; normal image display is technically possible. | No CORS byte/timestamp access; reuse terms not established. These candidates are not integrated or represented as approved replacements. |
| SWL / low-cloud charts | No automatic compatible path verified. | Metadata and base64-image APIs lack CORS; official pages block framing. Boundary-only WMTS layers are not weather products. Source links and an explicit manual local-image import are possible design options, not implemented automatic updates. |
| Native ICON-D2 CEILING | No equivalent browser-readable route verified. | Raw directory and actual GRIB file lack CORS; the existing 49-frame ecCodes pipeline cannot simply be moved into fetch. Official DWD WMS has 206 named layers but no equivalent model ceiling. Cloud fraction, convective base and ceilometer stations are not substitutes. |

## Actual browser observations

At approximately **10:22 Czech time / 09:22 UTC**, the prototype, without an extension or proxy, completed:

- **Six METAR, four TAF and one SIGMET** retrieved directly from SWIM. Current METAR observation times were 09:00 UTC. All raw reports and independent observation/issue/validity dates were displayed.
- The LKCS TAF remained **cancelled, issued October 5**, and the LKAA SIGMET retained **October 26 validity**. Neither was promoted to a fresh forecast/warning because its file was downloaded today. Missing LKHS/LOWL/LOWW and incomplete SIGMET coverage remained explicit.
- A genuine LKCS `FEW014/// OVC035///` report exposed an existing parser bug. The parser now retains the known **3,500 ft AGL** OVC height while stating that cloud type is unknown. Regression fixtures also keep an unknown-height `BKN//////` as unknown.
- A **1000 × 500 GeoColour PNG**, observed **09:00 UTC**, downloaded directly and decoded; its original timestamp, crop and source URL were displayed. The adapter validates bytes/dimensions and embeds the result locally.
- Four actual observed radar PNGs, **09:05, 09:10, 09:15 and 09:20 UTC**, loaded successfully. Their candidate timestamps became observations only after image load. The export restriction remained explicit.
- The official municipal camera played at **2592 × 1944**, `readyState:4`, unpaused, no video error. Playback time progressed from approximately **21 s to 201 s** across observations. This proves playback in the tested browser, not an independently known camera exposure time, uptime or offline capture.

These are actual browser results from the managed preview origin. Separate HTTP checks sent `Origin: https://xefensor.github.io`; the public Pages prototype is checked after publication. Mobile Safari/Firefox playback, complete assistive-technology review and intended-pilot acceptance are not established by these observations.

## Adapter and failure contracts

`aviation-source.js` uses a fixed official origin, advertised allowlisted files, at most two concurrent requests, bounded report sizes and original TAC text. It resolves day-only TAC dates against the dated catalogue, never blindly against today. Each section separates successful transport from partial geographic/temporal coverage. Genuine previous direct-source reports may be retained after a failed refresh only with their original retrieval/source times. History includes only actually observed reports; gaps remain gaps.

`satellite-source.js` selects the exact GeoColour layer, validates the advertised UTC time inventory, excludes future frames, applies WMS 1.3 latitude/longitude axis order, bounds requests and validates PNG bytes/dimensions. It can try one actual preceding advertised frame with a note. The integrating caller must keep a newer retained image rather than regress to an older fallback.

`radar-source.js` loads at most 24 five-minute candidates with two concurrent images. A lightweight check uses four candidates to tolerate publication lag; full history should be requested lazily. Normal image display grants no pixel read access. Its returned metadata declares display-only export limits.

The prototype makes no production source substitutions. It adds no arbitrary CORS proxy, credentials or browser-security changes.

## Primary sources and reproducible routes

- [ČHMÚ SWIM service information](https://swim.chmi.cz/info.php) and [June 2026 API reference](https://swim.chmi.cz/SWIM_API_reference.pdf). Direct listing: `https://swim.chmi.cz/api.php?action=list&format=txt`; reports use advertised `file` with `action=get&format=txt`. Access/CORS does not establish a blanket redistribution licence.
- [AWC API](https://aviationweather.gov/data/api/) documents CORS limitations. Existing AWC coverage/history cannot be assumed to transfer to SWIM.
- [EUMETSAT WMS](https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetCapabilities&version=1.3.0), exact `mtg_fd:rgb_geocolour` product. Existing EUMETSAT/NASA attribution and product-specific licence remain applicable.
- [ČHMÚ radar description](https://opendata.chmi.cz/meteorology/weather/radar/radar_description_en.pdf) and [PNG directory](https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/). Template: `pacz2gmaps3.z_cappi020.YYYYMMDD.HHMM.0.png`, UTC. Whole-image bounds remain `[[48.047,11.267],[52.167,20.770]]`.
- [Official city camera page](https://www.c-budejovice.cz/webove-kamery) links the [Radnice viewer](https://stream.c-budejovice.cz/webkamera-4-radnice.html). The prototype uses that provider-controlled viewer; it does not rehost or capture the stream.
- [Ski Kvilda owner page](https://www.skikvilda.cz/areal/webkamery) links `https://data6.isenzor.cz/K1189568/aktualni.jpg`; [Šumava.eu camera page](https://webcam.sumava.eu/) advertises `https://camdata.sumava.eu/kvilda/1024/last.jpg`. These remain technically checked candidates with unresolved reuse terms.
- [Original ČHMÚ camera directory](https://www.chmi.cz/namerena-data/webkamery). Example timeline: `https://data-provider.chmi.cz/api/playableImages/init/web-kamery/ceske_budejovice`; its linked replay script fetches frame JSON/base64. Modern pages forbid external framing. [Official legacy-site notice](https://intranet.chmi.cz/zpravy) warns that old data flows and freshness were being withdrawn; guessed legacy URLs are not a reliable solution.
- [SWL page](https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa), [low-cloud page](https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti), SWL metadata `https://data-provider.chmi.cz/api/data/txtf/letectvi.cr-swl/`, SWL image `https://data-provider.chmi.cz/api/image/data/predpovedi.cr.swl/`, low-cloud configuration `https://data-provider.chmi.cz/api/map/init/letectvi-cz.Oblacnost`.
- [DWD official WMS](https://maps.dwd.de/geoserver/dwd/wms?service=WMS&request=GetCapabilities&version=1.3.0). CORS is enabled, but the inspected named-layer inventory has no native model CEILING equivalent. [DWD raw CEILING](https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/CEILING/) remains a distinct blocked binary data path.

## Validation and next integration boundary

Deterministic checks cover TAC identity/date rollover, old cancellation/expiry, partial/retained transport, real-history bounds, unknown cloud type/height, satellite inventory/fallback/geometry/abort, radar confirmed-frame selection/concurrency/gaps and versioned prototype module resolution. Final full-suite/build/document/publication evidence is recorded in [deployment](deployment.md).

Before replacing the main briefing, wire coverage-aware report/SIGMET states, preserve source-specific timestamps, make radar loading lazy, retain newer satellite imagery after fallback and make every lost output/source capability visible. The exact original cameras, complete regional warning/history scope, native ceiling and integrated charts remain concrete source dependencies. The whole agreed project is not complete under the new browser-only requirement.
