# 0016 · Further browser source recovery

Date: 2026-11-02

Status: published as the v0.7 evaluation in application commit `63a927d424865ef93534729b50637a98e0cb5be4`, with the scoped source and browser checks below. Final full-suite, output and public HTTPS evidence is recorded in [deployment](../deployment.md). This extends [decision 0015](0015-native-browser-recovery.md) and the [browser feasibility record](../browser-only-feasibility-2026-11-02.md); it does not establish complete source coverage or professional readiness.

## Context and three-study review

The owner requested further practical work to display the remaining products. The ordinary-browser constraint still applies: no extension, native application, project-operated backend/proxy or deployment-time weather collector. Provider-controlled public distribution, browser decoding and explicit local-file import offer different capabilities. A successful workaround must preserve those differences.

| Study | Applied choice |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Restore significant-weather evidence and useful cloud-height information while preserving source, chronology, vertical reference and missing coverage. A nearby station or different model cannot silently become the missing original product. |
| [Interface references](../research/interface-references.md) | Keep original maps inspectable with enlargement, coordinate maps and graphs through the selected time, and retain rich regional information without repeated setup. Source explanations stay beside the relevant product. |
| [Data sources](../data/sources.md) | Validate actual image/raster content, use advertised provider routes, distinguish processed AGL from native MSL, and record access and reuse limits independently of transport success. |

## Decision

### Direct SIGMET / AIREP source image

The workspace now displays `https://meteo.rlp.cz/sigmetmap.png` as an ordinary cross-origin image, with an enlargement control and source/documentation links. The original graphic is headed **SIGMET, AIREP Special map**. The official ŘLP help identifies ČHMÚ as its meteorological-data supplier. This adds graphical evidence alongside the existing, conservatively scoped SWIM reports; it is not a complete machine-readable warning service.

The adapter allows only the exact HTTPS image path and an optional canonical five-minute cache key. Loading is bounded by timeout and dimensions; aborts and failed loads cannot become confirmed imagery. The browser confirms image loading, not the issue time, update time, forecast validity or geographic completeness. Those normalized source times remain null, `coverageComplete` remains false, and the reader must inspect the original UTC heading and legend. An empty graphic or an empty response cannot establish an all-clear.

Frozen briefings preserve the allowlisted online link, attribution and actual last confirmed load evidence. They do not automatically load or embed the remote map. Imported metadata must retain the same load proof, valid retrieval time and bounded dimensions as live metadata. A failed refresh may retain the previously confirmed link and its original load time; its mutable address cannot guarantee identical pixels. No additional redistribution grant for the ŘLP-rendered graphic has been established.

### Original ČHMÚ low-cloud map through explicit local import

Automatic reading of the original ČHMÚ map remains blocked. Its advertised frame route returns JSON containing a base64 PNG without compatible CORS, while the original viewer prevents external framing. The implementation therefore adds an explicit **local-file import**, not an automatic feed or a proxy.

The user can download original frame JSON or PNG and select it locally. Accepted names retain the original `YYYYMMDDHHMM` UTC slot, with an optional `.json` or `.png` extension, on a three-hour boundary. Import accepts at most twelve distinct slots, eight MiB of raw files and two MiB per PNG; the merged local set is further bounded to six MiB of image bytes. It checks the JSON envelope, canonical base64, PNG signature/chunks/checksums, dimensions and actual browser decoding. Malformed, animated or duplicate-slot files fail explicitly. These checks validate the file format; they do not authenticate the author or independently prove its weather/time content.

The filename supplies a candidate time only: `timeBasis: 'filename-unverified'` and `validityConfirmed: false` remain attached. Issue time and original retrieval time stay null. `importedAt` records the actual local import, never a fabricated provider publication or download time. The visible notice continues to say that the file does not update automatically.

The shared viewing time selects the nearest imported slot only within **90 minutes**; outside that window, the chart and overlay remain missing. No interpolation or substitute frame fills a gap. The image retains ČHMÚ credit, its original legend, **hft AMSL** units and advertised geographic bounds. It can be enlarged or placed on the regional map. Frozen output can embed the selected local frame and retain its geography, import evidence and unverified filename clock without a remote request. This recovers inspection of the original product, but not automatic discovery, freshness or independently verified validity.

### Separate ClearToFly processed ceiling in ft AGL

A second ceiling product now loads directly from the public distribution advertised by ClearToFly's actual client. Discovery follows its `latest.json` and the exact linked ceiling viewer; a bounded parser reads the viewer's published configuration without executing its scripts. Requests remain restricted to fixed catalogue/viewer/COG path patterns on `d34ooj23crdzyh.cloudfront.net`. The checked catalogue, viewer and TIFF objects permit CORS.

This is **DWD output processed by ClearToFly, in feet AGL**, delivered as an EPSG:3857 raster. It remains separate from the native ICON-EU product in **metres MSL**, the selected main point-forecast model, observations and the ČHMÚ map. ClearToFly documents a forecast stitched from ICON-D2-RUC, ICON-D2 and ICON-EU; the adapter identifies the actual model per advertised frame and does not consume unsupported ECMWF extension frames.

Per-model run times come from the provider's explicit dated RUC/D2/EU labels, checked against the run identifier. The catalogue's `providerReferenceTime` is a separate time-axis reference, not an initialization time. Catalogue publication, forecast-valid time and actual retrieval also remain separate. Missing explicit model/run evidence cannot be replaced with the catalogue clock.

The provider does not establish its terrain source or detailed MSL-to-AGL processing in the checked material. The adapter therefore preserves `terrainSource: 'unknown'` and the provider's AGL reference. It does not subtract ČÚZK/local terrain or relabel the result as native D2 CEILING. DWD/ClearToFly attribution remains visible; additional reuse terms for the processed COGs were not established. Public CORS does not settle that permission or professional service access.

A narrow JavaScript TIFF reader uses the browser's Deflate decompressor in a worker. It validates the supported 32-bit float, tiled, EPSG:3857 PixelIsArea encoding and NaN missing-value declaration; unsupported forms fail. Each file is capped at eight MiB and two million pixels. At most two provider requests run simultaneously, and the decoded cache holds eight fields. The initial view requests six hourly samples plus the selected frame when distinct.

Point values come from the actual containing raster pixel, with its centre and distance shown. The regional graphic displays a declared subset of actual pixel centres and preserves missing values; gaps between dots are not interpolated coverage. The graph and table keep each sample's model, run, validity and retrieval time, including model transitions and failures. Frozen output can retain the numeric evidence and local SVG alongside the same provenance limits. A missing height is never interpreted as clear sky.

### Hosín remains an official external station link

The Hosín operator's pilots page links **Data z meteo stanice** to the public Weathercloud **LKHS - METEO** station. The workspace may preserve that official external link as local corroboration. It is not an LKHS METAR or TAF, and no authoritative missing LKHS report feed has been established.

Weathercloud's checked FAQ says it currently provides no data-retrieval API. Its terms restrict extraction and unauthorized API clients and require prior written consent for third-party applications interacting with its content. The FAQ's owner-generated Sticker is a specific supported embedding mechanism, not permission to frame or scrape the station page. No Weathercloud API adapter, scraper or station iframe is introduced. Any later integration needs the relevant provider/owner permission and a supported delivery route.

## Alternatives and consequences

Keeping every blocked product as a link would preserve honesty but lose useful inspection and graph depth. The chosen routes recover the capabilities actually supported: direct warning-image display, deliberate local original-map import, and separately labelled processed AGL data. They do not remove the original source gaps by renaming alternatives.

An arbitrary public CORS proxy, disabled browser security, extension, project weather backend or build snapshot would conflict with the owner constraint and is not part of this decision. A complete warning inventory still needs a verified source with geographic scope, current bulletin lifecycle and suitable access rights. The newly loaded warning image cannot supply those machine-readable guarantees.

## Scoped verification and completion

Checks on 2 November 2026 distinguish source requests, decoder comparison and actual local UI behavior:

| Check | Established evidence and boundary |
| --- | --- |
| ŘLP warning image | Actual HTTP PNG and local browser decode at **1500 × 900**. This verifies display, not current issue/validity or complete warning coverage. |
| Original ČHMÚ import | An actual original **1654 × 1169 PNG** decoded in the browser and appeared as the regional overlay. The persistent filename-unverified notice remained. No automatic refresh was established. |
| Processed TIFF decoding | All **918,750 pixels** of a real raster matched an independent Pillow decode. Live RUC, D2 and EU samples were separately checked through the adapter. This validates the tested encoding and sampled data path, not forecast accuracy or every future file. |
| Local processed-AGL UI | The browser displayed **4,084 ft AGL** for **13:45 Czech time**, with the RUC run labelled **12:00 Czech time** and retrieval **13:49 Czech time**. Six hourly rows and two SVGs rendered; the regional plot showed **1,434 actual centres from a 12,900-pixel crop**. The native MSL product remained separately visible. A pinned 3 November 03:00 CZ selection subsequently displayed actual ICON-D2 at 2,683 ft AGL, with its own 2 November 10:00 CZ run, while the main model was ECMWF and native ICON-EU separately displayed 1,279 m MSL. |

Deterministic tests cover source allowlists, image-load proof and failure cleanup, strict local files, filename-clock limits, TIFF bounds/georeferencing/missing values, catalogue/run separation, field failures and processed-output validation. The **325-test** combined suite passed. Responsive/output checks, source commit and the verified published build are recorded in [deployment](../deployment.md), including the distinction between successful local import and the declined public browser file-selection approval.

**The whole project remains incomplete.** Automatic original low-cloud access, complete current warning scope, authoritative LKHS report coverage, relevant provider/redistribution agreements, intended-pilot acceptance and target-browser native save/print checks remain concrete dependencies. See the [release checklist](../release-checklist.md).

## Primary sources checked 2 November 2026

- [ČHMÚ SIGMET/airport-warning page](https://www.chmi.cz/letectvi/sigmet-vystrahy-pro-letiste), [actual ŘLP SIGMET/AIREP image](https://meteo.rlp.cz/sigmetmap.png) and [ŘLP OPMET documentation](https://meteo.rlp.cz/met_help_cz.html). The separate ČHMÚ `https://data-provider.chmi.cz/api/image/data/predpovedi.sigmet/` JSON/base64 route remained without compatible CORS.
- [ČHMÚ low-cloud explanation](https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti), [advertised map configuration](https://data-provider.chmi.cz/api/map/init/letectvi-cz.Oblacnost), [actual frame example](https://data-provider.chmi.cz/api/data/letectvi/img-forecast/oblacnost/202611021200) and [ČHMÚ content terms](https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti).
- [ClearToFly about](https://cleartofly.de/about), [ceiling explanation](https://cleartofly.de/learn/ceiling), [public latest catalogue](https://d34ooj23crdzyh.cloudfront.net/latest.json), [sampled advertised viewer](https://d34ooj23crdzyh.cloudfront.net/viewers/ceiling-viewer-2026110209_2026110211_2026110206.html) and [sampled processed TIFF](https://d34ooj23crdzyh.cloudfront.net/cog/ceiling_2026110209_2026110211_2026110206_h00m00.tif). These dated sample URLs explain the investigation; runtime discovery follows the current catalogue.
- [Official Hosín pilot information](https://www.letiste-hosin.cz/cs/pro-piloty/informace-pro-piloty/), [linked LKHS - METEO station](https://app.weathercloud.net/d5920751771#current), [Weathercloud terms](https://weathercloud.net/en/terms-of-service) and [FAQ](https://weathercloud.net/cs/faq).
- [ČHMÚ SWIM service scope](https://swim.chmi.cz/info.php), [TAC catalogue](https://swim.chmi.cz/api.php?action=list&format=txt) and [SIGMET XML inventory](https://swim.chmi.cz/api.php?action=list&format=xml&type=SIGMET). The checked TAC catalogue still carried October 26 SIGMET files; an empty XML inventory did not establish complete current regional coverage.
