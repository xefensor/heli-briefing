# Build and publish

## Current release · v0.8 evidence-first workspace

[Decision 0017](decisions/0017-evidence-first-workspace.md) and the [UI/UX review](design-review-2026-11-02.md) record the three-study redesign. All existing source adapters and browser-only limits remain. Local checks passed **352 tests (310 JavaScript, 42 Python)** and a **65-file** code/assets build with asset `d65c8915772ac2d3e9fe`. The dated review records actual comparison/readout/keyboard, station-context, disclosure, image-dialog and source-reference checks. Desktop content/scroll width matched at **1348 px**; 390/320 px frames matched at **375/305 px**. A 768 × 420 px frame used a scrolling header and correct 20 px anchor offset. Full frozen output retained 16 SVGs, both independent ceiling maps and comparison readings, with no remote images/iframes and matching **1287 px** desktop / **330 px** phone widths; compact preview also matched at 1287 px. Native download/reopen/print/PDF, complete accessibility and intended-pilot acceptance remain unverified. Initial publication succeeded in [Pages run 41459536779](https://github.com/xefensor/heli-briefing/actions/runs/41459536779) for `bfd53c61f76001bcd126dfbb49d5c4f7b0badd2a`. Final public keyboard QA found lost focus after asynchronous preview preparation; the corrected application was published by [Pages run 41460417030](https://github.com/xefensor/heli-briefing/actions/runs/41460417030) for **`6fe655ac640f3814c6727affc56af43b64ad14af`**. [Its documentation workflow](https://github.com/xefensor/heli-briefing/actions/runs/41460416997) also passed. Final public HTTPS loaded asset **`d65c8915772ac2d3e9fe`** and all three added stylesheets. A fresh `build-info.json?release=6fe655ac640f3814c6727affc56af43b64ad14af` matched that exact commit and asset; an earlier unqueried metadata response briefly retained the previous deployment in cache.

The public page displayed all **eight** core plots and **nine** station rows, exact ALADIN/ICON-D2 selected readouts and the new reading order. The warning map decoded at **1500 × 900**; native ICON-EU remained **1,432 m MSL** and the independently processed product displayed **4,226 ft AGL** at that check. Public body content/scroll width matched at **1348 px**. Full public preview retained **16 SVGs**, both independent ceiling regional maps and model-comparison readings, with **no remote images or iframes** and matching **1287 px** width. After the focus correction, actual public preview closure returned focus to **`save-briefing`**. A fresh screenshot of the final public build shows the readable comparisons, shared context and nearby reports. No native download, reopen, print/PDF, physical-device/pilot or complete accessibility acceptance is inferred.

## Previous release · v0.7 further browser recovery

[Decision 0016](decisions/0016-further-browser-source-recovery.md) adds direct ŘLP SIGMET/AIREP image display, explicit local original low-cloud attachment and a separate ClearToFly processed ceiling in ft AGL. Both decoder workers run in the browser. GitHub Pages remains code/assets only, with no extension, project proxy/backend or weather build.

Actual local checks loaded the 1500 × 900 warning map and imported/decoded a real 1654 × 1169 original ČHMÚ frame. Its regional overlay retained the manual/filename-unverified notice and disabled radar. The import leaves source issue/retrieval unknown and does not update automatically. A separate AGL view loaded six hourly values and 1,434 actual raster centres, showing RUC at 4,084 ft AGL for 13:45 CZ with its own 12:00 CZ run. Pinning 3 November 03:00 CZ displayed real ICON-D2 at 2,683 ft AGL (run 2 November 10:00 CZ), while the main model was ECMWF and the native ICON-EU reading remained 1,279 m MSL. Body content/scroll width matched at 1348 px. These are decoder/source/UI checks, not local forecast-skill validation.

Final local checks passed **325 tests (283 JavaScript, 42 Python)**, a **60-file static build** with asset `0898bd027ad3fb7cf039`, all **39 Markdown link checks** and whitespace checks. The 390 px responsive view had matching 375 px body content/scroll width, eight populated core plots and a processed AGL regional plot. Full frozen output retained both native MSL and processed AGL region SVGs, the SIGMET/AIREP online link and no remote image/iframe loads. Its body content/scroll widths matched at 1287 px on desktop and 330 px in the phone dialog. The preview now exposes a persistent real HTML download link with the captured filename; this browser environment still returned no completed download for either the normal event or documented file-link fallback, so file delivery and native print/PDF remain unverified. The whole professional project remains incomplete at the source/access/pilot/native-output boundaries in the release checklist. Earlier entries are historical checkpoints.

Published by [Pages run 41452052217](https://github.com/xefensor/heli-briefing/actions/runs/41452052217) for application commit `63a927d424865ef93534729b50637a98e0cb5be4`; [its documentation workflow](https://github.com/xefensor/heli-briefing/actions/runs/41452052393) also passed. Public HTTPS loaded asset `0898bd027ad3fb7cf039`, and `build-info.json` matched that exact commit. Actual public checks loaded all eight core plots, all three **1600 × 1200** original camera views, the **1500 × 900** warning map, and both ceiling products. The live processed RUC value was **3,534 ft AGL**, valid 2 November 14:30 CZ with its own 13:00 CZ run. Pinning 3 November 12:00 CZ with ECMWF selected displayed processed **ICON-D2 at 2,921 ft AGL** (run 2 November 10:00 CZ), while native **ICON-EU remained 887 m MSL** (run 2 November 07:00 CZ). These values came from later live frames/catalogues than the local checks above; they are dated test evidence, not a forecast recommendation.

The full public frozen preview retained the processed and native regional SVGs, their independent model/run/units, and the SIGMET/AIREP online source link with its confirmed retrieval bucket. It contained **15 SVGs, no remote images and no iframes**, with matching **1287 px** body content/scroll width. The live page matched at **1348 px**. A saved public screenshot shows the actual D2 value and six-hour graph beneath the shared ECMWF/place/time controls. Repeating the low-cloud file import on the public page was blocked by a declined browser file-selection approval; it was not retried or bypassed. Its successful original-file decoding/overlay check remains a **local-preview** result, not a public-site acceptance claim. Native download/print/PDF and intended-pilot acceptance remain unverified.

## Previous deployment · v0.6 native browser recovery

[Decision 0015](decisions/0015-native-browser-recovery.md) adds the original three ČHMÚ camera views through their public In-počasí/Ventusky JPEG distributor and actual native ICON-EU CEILING through the CORS-enabled Source Cooperative archive. A small JavaScript GRIB/AEC decoder runs in a bounded worker. The main application ships no WASM, weather snapshots, collection schedule, project backend or proxy. The original ČHMÚ low-cloud map and direct ICON-D2 remain separate unavailable products.

Local checks passed **279 tests (237 JavaScript, 42 Python)**, a **52-file static build** with asset version `f9693e2e87aba4cd470f`, all **38 Markdown link checks**, and whitespace checks. Actual desktop and 390 px responsive checks displayed all three full-resolution 1600 × 1200 camera views, all eight core plots, a native ceiling point and a 985-cell regional plot. Desktop content/scroll width matched at 1348 px; the responsive frame matched at 375 px. Camera exposure time remains unknown and must be read from the image itself. The distributor's mutable hourly JPEG was rechecked with changed source clocks/content and later HTTP modification times.

The native six-hour request and explicit twelve-hour extension returned real frames. Changing the main forecast to ECMWF retained the separately labelled ICON-EU ceiling. Pinning another inspection hour selected the matching native frame. Full frozen output retained its native point, time series and regional SVG, embedded one decoded satellite image, and loaded no remote camera image or iframe; its three camera links remained online-only. Output content/scroll width matched at 1306 px on desktop and 330 px in the phone dialog; the phone output also retained the native regional SVG without remote image/iframe loads. A route sample also retained its own ICON-EU model/frame/retrieval metadata. Native file/PDF delivery, intended-pilot acceptance and the remaining professional source/access gates remain unverified.

Published by [Pages run 41441852565](https://github.com/xefensor/heli-briefing/actions/runs/41441852565) for application commit `4210dd38948cb1374185fd345aabd88330f29f19`; its documentation workflow also passed. Public HTTPS loaded asset `f9693e2e87aba4cd470f`, and `build-info.json` matched that exact commit. A fresh public page loaded all eight plots, all three 1600 × 1200 camera images and six real native CEILING hours. Its selected 13:00 CZ frame from the 06 UTC run was 3275.6 m MSL, with the correct 985-cell regional plot. Public body content/scroll width matched at 1348 px. Full public frozen output retained that regional SVG, one decoded 1000 × 500 embedded satellite and three online camera links, with no remote image/iframe loads and matching 1287 px content/scroll width. The saved public screenshot shows the three original camera views beneath the shared place/model/time controls. Earlier sections are historical checkpoints.

## Current deployment · v0.5 ordinary-browser runtime

The main workspace uses direct browser data sources under [decision 0013](decisions/0013-direct-browser-integration.md). GitHub Pages hosts **code/assets only**. The workflow has no weather schedule, collectors, decoder installation or weather caches. It runs application/document checks, builds and deploys on application changes to `main` or explicit workflow dispatch.

```sh
npm test
python3 scripts/check_docs.py
npm run build
npm run dev
```

The build excludes **all `web/data`**, including locally retained/generated snapshots and nested imagery, and generates no fallback weather JSON. An artifact regression test checks actual built output with weather marker fixtures. Historical Python collector code/tests remain in the repository but are not part of deployment. The older collector commands and publication records below are historical; they do not describe the current runtime.

SWIM reports refresh directly about every five minutes, with bounded genuine browser-local history and explicit partial coverage. EUMETSAT satellite frames refresh directly with original observation/download times. Radar loads confirmed provider PNGs (four current candidates; up to 24 on playback). The municipal viewer opens directly on request and remains mounted across refresh. Native ceiling, original cameras and original aviation charts remain explicit unavailable states/source links; no old build snapshot is used as fallback. Full output identifies online-only radar/video and the available embedded satellite.

Local validation passed **217 tests (175 JavaScript, 42 Python)**, a **42-file static build**, documentation and whitespace checks. Actual desktop checks loaded all eight plots, nine report entries and real LKCS observations, preserved pinned inspection/source comparison and kept the 2592×1944 municipal viewer mounted during refresh/model changes. Reload visibly restored unconfirmed cached reports before live refresh. A 390 px responsive frame had equal 375 px content/scroll width; a new frozen preview retained SWIM/partial-coverage/source-limit text and a decoded satellite image without iframe/video requests. [Pages run 41426602673](https://github.com/xefensor/heli-briefing/actions/runs/41426602673) succeeded for application commit `1f7ecca0db3e17e640ab7d795102206a4b0dfcf1`. Public HTTPS loaded expected asset version `5a5e604c19a2141c843e`, all eight plots and nine station entries. Direct SWIM returned actual LKCS observations, SIGMET remained explicitly uncertain, satellite decoded and four real radar images loaded. The municipal viewer played at 2592×1944 with readyState 4. A full public frozen briefing had matching 1306 px client/scroll width, one decoded embedded satellite image, coverage/provider notices and no iframe/video. Public build-info matched the application commit; HEAD checks on all five old weather JSON URLs returned 404. The final camera-height refinement was published by [Pages run 41428175775](https://github.com/xefensor/heli-briefing/actions/runs/41428175775) for application commit `dea8e2a9a29601f9d573b106b773b1f4580a24b2`. Public HTTPS then loaded asset version `db0f34e0aea7b7d8952b`, all eight plots and direct SWIM report metadata. The municipal iframe measured about 915 px high, enough for the complete provider player; its actual 2592×1944 video had readyState 4, was unpaused and advanced beyond 157 seconds. An independent final audit again confirmed the public build identity and absence of old weather JSON. The saved public screenshot shows the camera playing within the shared place/model/time controls.

The browser runtime migration for compatible sources is implemented. Whole-project professional readiness remains incomplete at the source-parity, access/licence, intended-pilot and native save/print gates in the [release checklist](release-checklist.md).

## Source-gap recovery · v0.5.1 · 2 November 2026

[Decision 0014](decisions/0014-browser-source-gap-recovery.md) restores original SWL display directly from its official ŘLP distributor, adds the separately identified MET Norway report/archive supplement, and adds one-action alternate viewers for the same original three cameras. No deployment-time weather collection or project data service returns. The large ceiling experiment is separate from the main runtime and excluded from the static artifact.

Local checks passed **241 tests (199 JavaScript, 42 Python)** and a **44-file static artifact (686,404 bytes before the final map-width refinement)**. All 37 Markdown link checks passed, including the new decision and reproducible research harness. Real desktop and 390 px responsive checks loaded the 2339 × 1654 SWL, all eight forecast graphs, LOWL/LOWW reports and a 24-observation LKCS history. Phone content/scroll width matched at 375 px. SWL enlarged in one action and returned keyboard focus when closed. Reload retained both providers as unconfirmed local cache before live refresh. Full output had matching 1306 px client/scroll width, a decoded embedded satellite and no remote image/iframe loads; SWL remained an online-only link with unverified normalized validity. Compact output retained LOWW original TAF and MET Norway source links with matching 1287 px body content/scroll width. Native file/PDF delivery and intended-pilot acceptance remain unverified.

A separate actual browser experiment retrieved Source Cooperative's advertised ICON-EU run listing and real CEILING GRIB, decompressed bzip2 and decoded a matching field/sample in 1,973 ms. It used approximately 41 MB of static decoder assets and a 116 MB WASM heap. This establishes browser feasibility for the tested **ICON-EU** sample, not restored native ICON-D2 or production-ready native-grid support. See the decision for the November 30 grid transition and remaining checks.

Initial source recovery was published by [Pages run 41433172801](https://github.com/xefensor/heli-briefing/actions/runs/41433172801) for commit `1b0df13ccedcf6de6e5bf2b7c973f0e8745cd81b`. Public HTTPS loaded asset `74afbf19a1ab3c22e99a`, all eight plots and the actual 2339 × 1654 SWL directly from ŘLP. LOWW displayed current MET Norway reports, and LKCS had 23 real in-window historical observations at that later check. SIGMET remained uncertain. Public full output had matching 1306 px content/scroll width, one decoded embedded satellite, no remote images/iframes, the SWL online link and actual MET Norway API/documentation/licence/terms links. Build-info matched the application commit. The reproducible ceiling harness was rerun from its saved setup and repeated its actual sample in 2,061 ms. The map-width refinement was published successfully by [Pages run 41434122692](https://github.com/xefensor/heli-briefing/actions/runs/41434122692) for application commit `d9f19859fef8395fd1209d61d55edd0ea9e16f97`. Public HTTPS loaded final asset `f9e01db50a6c460c6ff9`; the decoded SWL displayed at 1084 px within a 1126 px panel, and page content/scroll width matched at 1348 px with all eight plots populated. The original UTC issue/validity header was readable in the captured public screenshot. All 241 tests and 37 documentation checks passed after that refinement.

## Historical deployment and validation records


[Documentation index](README.md) · [Hosting decision](decisions/0004-github-pages-first-build.md) · [v0.2 data scope](decisions/0005-complete-briefing-data.md)

The evaluation is [published on GitHub Pages](https://xefensor.github.io/heli-briefing/). Static source lives in `web/`; generated deployment output lives in ignored `dist/`. The browser application/build has no npm installation step or application framework dependency. Native GRIB ingestion uses separately installed, pinned Python decoder packages.

The first v0.2 publication was confirmed on **2026-11-01**: [workflow run 41317467329](https://github.com/xefensor/heli-briefing/actions/runs/41317467329) successfully built and deployed source commit [`bdec823f38f8e310207b91214a5b9ec3afd07b6c`](https://github.com/xefensor/heli-briefing/commit/bdec823f38f8e310207b91214a5b9ec3afd07b6c). The earlier [v0.1 workflow](https://github.com/xefensor/heli-briefing/actions/runs/41315499572) remains historical publication evidence.

## v0.2 verification record

- Local deterministic checks passed: **105 tests**, comprising 77 JavaScript and 28 Python tests.
- Actual native DWD ingestion produced **49 hourly valid times and 6,693 native cells** in the regional crop.
- Local browser checks covered desktop and 390 px layouts without horizontal overflow, an honest outside-region native-cloud state, and a pinned **2 November 10:00** inspection time retained across refreshes and clock ticks.
- The radar loop displayed actual past acquisition times. Frozen report preview rendered the charts, native cloud data, METAR history and radar with original timestamps.
- The report-output preview dialog is implemented. File-download completion was not captured by the browser check; do not describe that event as verified. Public HTTPS runtime checks and pilot usability are separate from the local checks and successful deployment above.
- Public HTTPS checks subsequently loaded the native cloud panel and validated the actual deployed JSON: `status: ok`, run 12 UTC, retrieved 14:42:49 UTC, 6,693 cells and 49 valid hours. The LKCS nearest 15 UTC sample was 1,534 m MSL, with the native cell 0.58 km away. `build-info.json` matched the v0.2 release commit. The cloud browser reported a failed download operation during the HTTPS export test; the saved preview and captured data were verified, but file delivery remains unverified in that environment.

## Local checks and build

Use Node.js 24 and Python 3:

```sh
npm test
python3 scripts/check_docs.py
python3 scripts/update_aviation.py --output web/data/aviation.json
node scripts/build.mjs
```

For the v0.2 native cloud snapshot, install its decoder in an isolated environment and collect before building:

```sh
python3 -m venv .venv-clouds
.venv-clouds/bin/python -m pip install --requirement requirements-clouds.txt
.venv-clouds/bin/python scripts/update_clouds.py --cache-dir .cache/clouds --output web/data/clouds.json
npm run build
```

`requirements-clouds.txt` pins ecCodes and its binary libraries. Browser code and deterministic tests remain independent of that decoder; tests that inspect live GRIB products are separate integration checks. `python3 scripts/update_clouds.py --cache-key` uses only the standard library to discover the newest complete native model run.

The generated regional `web/data/clouds.json` is ignored by Git. Pages builds collect it before packaging; a local build without an ingested file emits an explicit unavailable product. No synthetic seed weather is committed. The browser revalidates stable snapshot URLs so unchanged regional data can use HTTP cache validators instead of downloading the entire crop every five minutes.

Serve `dist/` through an HTTP server to inspect the browser application. Opening the files directly with `file://` is unsuitable for JavaScript modules and snapshot requests. `build-info.json` records the build time and, in Actions, the source commit. It is not weather freshness metadata.

## GitHub Pages setup

GitHub Pages is enabled for this repository. When recreating this setup in another repository, an owner with administration access must select **Settings → Pages → Build and deployment → Source: GitHub Actions** once. The linked [settings page](https://github.com/xefensor/heli-briefing/settings/pages) is the current repository configuration.

The `Deploy briefing to GitHub Pages` workflow runs on application changes to `main`, by manual dispatch, and at minutes 7, 27 and 47 each hour. It tests the application, checks documentation links, retrieves a bounded aviation-report snapshot and, in the v0.2 workflow, collects the native cloud diagnostic before building and deploying through the `github-pages` environment. Periodic retrieval does not modify the source branch. The environment's returned URL and a successful deployment establish publication; an expected URL alone does not.

Native cloud caching uses `.cache/clouds` with a key containing the actual complete DWD run identifier and a hash of the collector/requirements. There is no workflow-run suffix or fallback to a different model-run cache. A cached assembled crop can be reused across twenty-minute deployments without downloading the full GRIB fields again. Run discovery failure is handled explicitly: skip the cache restore and let the collector publish its honest stale/unavailable state. Decoder installation errors remain build failures. The decoder runs in `.venv-clouds`; the isolated environment and downloaded intermediates are not published.

The workflow has no provider secrets. Repository access is read-only; the deployment job additionally receives Pages write and OIDC token permissions. Initial enablement is not attempted with the Actions token because GitHub requires separate administration-capable access for that operation. No broader token should be pasted into the repository or client code.

## Runtime data and freshness

- Forecasts use the browser data adapter and preserve the selected model, grid, timestamps, units and null fields. Forecast model selection does not change aviation report authorities or astronomical calculations.
- Aviation reports use `data/aviation.json`, collected during each deployment because AWC does not support browser CORS. The snapshot includes retrieval state and source timestamps; a successful response can still contain old or expired reports.
- The base map uses the cached [ČÚZK ZTM_WM service](https://ags.cuzk.gov.cz/arcgis1/rest/services/ZTM_WM/MapServer) in Web Mercator. Its Czech coverage does not establish coverage outside Czechia. Display the required ČÚZK – on-line attribution, [metadata](https://geoportal.gov.cz/php/micka/record/basic/CZ-CUZK-AGS-ZTM-MERCATOR) and [service conditions](https://cuzk.gov.cz/Predpisy/Podminky-poskytovani-prostor-dat-a-sitovych-sluzeb/Podminky-poskytovani-sitovych-sluzeb-CUZK.aspx). The official conditions permit commercial and noncommercial use subject to reasonable service load; checked 2026-11-01.
- ČHMÚ radar is a timestamped pseudo-CAPPI 2 km observation, independent of the selected forecast model/time. The collector discovers its real image URL and uses whole-image bounds from the provider's product description; the overlay is not a radar forecast.
- A warning after an hour without a successful report-snapshot retrieval reflects three scheduled update periods, not a legal report-age limit. TAF validity is evaluated against the inspected time; METAR age remains relative to the actual clock. Unknown or expired products remain explicit.
- Upstream failures must produce explicit failure state. Previously retrieved content may be retained only with its original retrieval time and a stale/error indicator. No invented reports or weather values are allowed.
- GitHub schedules are best-effort. They may run late, and public-repository schedules may be disabled after inactivity. Read the displayed retrieval and product times; do not treat the configured twenty-minute interval as a freshness guarantee.

## Implemented v0.2 runtime behaviour

- While the page is active, a thirty-second tick updates ages. Forecast requests are due every ten minutes and report/radar/cloud snapshot checks every five minutes. Hidden/offline pages pause network activity and check again on return. A pinned inspection time is retained across refreshes; a live viewing mode may advance with the clock. Polling more often does not make the deployment snapshots newer.
- The native cloud layer comes from DWD ICON-D2 `CEILING` on its native mesh, cropped to the documented South Bohemian region. Its own model/run/validity remains visible even when another point-forecast model is selected. Values are metres MSL for the nonconvective greater-than-50% cloud diagnostic, not observed ceiling. Missing native values remain undefined and must not be labelled clear sky.
- Structured METAR summaries preserve missing fields, visibility bounds and raw text. TAF change periods are displayed explicitly rather than flattened into an overall permission to fly. A twelve-hour METAR history remains tied to each reporting station and actual observation time.
- The radar sequence holds up to twenty-four observed frames over two hours with acquisition times. Missing frames or incomplete history remain explicit. Animation does not imply a radar forecast.
- The report-output dialog previews a frozen briefing before output. HTML export captures the current briefing context and available data without making later live requests. Up to ten local archives are kept in the same browser; local storage is not an account or server backup. Source/run/validity/retrieval metadata and missing-data states remain part of the captured briefing.

These behaviours are implemented in v0.2. The verification record above states which checks were actually completed. Integrated cameras, satellite layers and full vertical route profiles remain open scope.

## Provider access before professional production

This build is an evaluation version using Open-Meteo's free hosted service within its applicable access terms. Its data licence and hosted API licence are separate. Professional/commercial production use needs the appropriate provider access; no paid service has been configured by this build.

Any future paid API credentials need a server-side adapter or ingestion service. GitHub Pages cannot keep a key private in JavaScript, environment-generated client files, query strings or local storage. Changing the forecast adapter should preserve model identity, field capabilities, timestamps and honest failure states.

See [data sources](data/sources.md) for provider terms and [data integrity](data/integrity.md) for interpretation requirements.


## Point-profile and satellite extension · 2026-11-01

[Decision 0006](decisions/0006-point-profile-and-satellite.md) records the current implementation and source checks. The forecast adapter requests six altitude-qualified pressure levels for ALADIN/ICON-D2 and invalidates earlier tab forecast caches with a new schema version. The workflow runs `scripts/update_satellite.py` before building; `web/data/satellite.json` is generated and ignored by Git, with an honest unavailable fallback in builds without collection. The browser checks it alongside the other five-minute snapshots. GeoColour uses its own advertised frame time, source attribution and a fixed central-European crop; model/time selection does not turn it into forecast imagery. Preparing a briefing opens a frozen preview, with explicit HTML download and print actions. Existing archives remain readable. Browser download completion and printed/PDF output remain unverified.

The satellite workflow now restores the last genuine snapshot with pinned `actions/cache/restore` and saves successful retrievals with `actions/cache/save`. A failed frame request retains the restored original timestamp and marks the product stale. On a fresh runner without retained imagery, one preceding frame may be requested within the provider-advertised interval, with an explicit fallback note. This addresses an observed upstream GetMap HTTP 500; it does not establish provider uptime.


## Versioned application assets · 1 November 2026

The static build keeps `index.html`, `build-info.json` and runtime `data/` snapshots at the root. It moves scripts, styles and vendored files together into `assets/<content-version>/`, preserving relative module imports and rewriting HTML asset URLs. The version covers application assets and HTML, excluding weather snapshots; scheduled weather-only updates therefore preserve the same application URLs. `build-info.json` records `assetVersion` as well as commit/build time. This prevents releases from deliberately reusing identical asset URLs after code changes; it does not claim to control every browser or CDN cache. See [decision 0008](decisions/0008-saved-points-and-time-continuity.md).


## Complete evaluation scope · 1 November 2026

[Decision 0010](decisions/0010-route-section-and-visual-evidence.md) completes the buildable evaluation backlog with route wind/temperature/RH sections, separate DMR 5G terrain, three ČHMÚ-authored cameras, SWL/low-cloud charts and a two-day calculated astronomy graph. Local checks passed **169 tests (127 JavaScript, 42 Python)**, a static build and relative documentation checks. Current support, retention, intended-pilot acceptance and external gates are in the [release checklist](release-checklist.md).

The workflow runs the bounded camera and chart collectors alongside the existing report/native-cloud/satellite collectors. Generated `web/data/cameras.json`, `charts.json` and `charts/` are ignored. Browser code receives only generated snapshots/static images; neither provider credentials nor third-party camera API keys are embedded. Restore/save caches retain original image/source times after failure. Website APIs are not contracted provider interfaces.

```sh
python3 scripts/update_cameras.py --output web/data/cameras.json --cache-dir .cache/cameras
python3 scripts/update_charts.py --output web/data/charts.json --cache-dir .cache/charts
```

Actual collection returned three 1600×1200 cameras, an SWL PNG (2339×1654), and fifteen low-cloud PNGs. Other advertised future low-cloud frames remained explicitly unavailable. Local browser checks loaded the camera/chart images, a 17-column ALADIN route section and **257/257** actual Bpv terrain samples between Planá and Kvilda. Arrow-key section inspection changed the exact numeric sample. Low-cloud activation disabled and removed observed radar rather than overlaying the two products.

Desktop content width equalled scroll width (1348 px); the 390 px mobile iframe retained 375 px content width without page overflow. Its output dialog measured 335 px client/scroll width and about 509 px document height. Full-output checks embedded satellite, three cameras, SWL, low-cloud and the selected radar raster as data images with no automatic remote image requests. The image-rich snapshot exposed the old localStorage size limit. It now saves atomically in IndexedDB with a ten-record / 20 MB serialized budget; a browser reload confirmed the new snapshot and the copied legacy record. Browsers without IndexedDB retain the five-megabyte legacy path. Compact output retained nine original-report station entries and copied 3,396 characters in the sampled check. Tests cover both storage budgets and non-overwrite behavior.

The supported cloud-browser download check timed out waiting for its native download event and returned no file path. The normal print action exposed no native output artifact. These are **unverified native save/print checks**, not evidence that the HTML payload is invalid or that target-browser delivery works. The complete HTML preview, embedded images, copy, archive persistence and deterministic offline-content checks passed. Actual target-device file reopen/PDF acceptance remains on the pilot checklist. No browser-internal downloads page, alternate browser driver or sandbox bypass was used.

Initial publication for this scope succeeded in [Pages run 41339510300](https://github.com/xefensor/heli-briefing/actions/runs/41339510300) for application commit `02afd018773b53b493fb557afdec246d639f147b`. The final validation follow-up and public-HTTPS evidence are recorded below.


The validation follow-up [Pages run 41339822041](https://github.com/xefensor/heli-briefing/actions/runs/41339822041) succeeded for commit `a241a0198d609374d10dbf9e414ed857e0320055`. Public HTTPS loaded asset version `2d610ccb8fd6093fbbd4`, all eight forecast graphs and the new astronomy graph. The live route produced 17/17 vertical columns and 257/257 terrain samples. Its captured full briefing rendered four route-section plots and seven successfully decoded embedded images (satellite, three cameras, SWL, low-cloud and radar), and saved in the browser archive. Final archive-copy cleanup and its release evidence follow below.


[Pages run 41340487487](https://github.com/xefensor/heli-briefing/actions/runs/41340487487) succeeded for archive-cleanup commit `425f80d774bbeadc324c0d6ed6876db2c628d8eb`. Final lifecycle review also connected an enabled route section to manual/global and periodic route weather refresh. Local browser verification observed refreshed forecast retrieval at 20:15 CZ while unchanged terrain retained its actual 20:14 CZ retrieval. This is intentional provenance preservation, not a fabricated new terrain timestamp. All 169 deterministic tests, the static build and 29-document link checks passed after the lifecycle correction.


### Final evaluation publication

[Pages run 41340900375](https://github.com/xefensor/heli-briefing/actions/runs/41340900375) completed successfully for final application commit [`ab5e1d9c71f4765b29ebf15ec1541253c8a8a849`](https://github.com/xefensor/heli-briefing/commit/ab5e1d9c71f4765b29ebf15ec1541253c8a8a849). The public page was reloaded and loaded the expected final asset version **`3ffbd5319c5f5cbb6d1d`**. Its content width matched scroll width at 1348 px. Actual live model switching produced an ICON-D2-labelled route section with 17/17 vertical columns while the independent native ceiling and cameras retained their sources; returning to ALADIN invalidated/reloaded the section. Live SWL imagery decoded at its original 2339 px width, alongside the 1654 px low-cloud image. The same scoped images had decoded in the full frozen output.

The buildable v0.3 evaluation scope is finished and published. The **whole professional project is not operationally complete**: appropriate professional provider access, the owner's project licence, intended-pilot processing/usability acceptance and actual target-browser native save/print remain external gates. Integrated NOTAM/airspace redistribution additionally requires authorized access if that capability is taken into scope. These gates and a concrete pilot script are maintained in the [release checklist](release-checklist.md); there is no remaining declared engineering feature checkpoint to hand back as though it were completion.


## Professional workspace redesign · 1 November 2026

Version 0.4.0 implements the [full UI/UX review](design-review-2026-11-01.md) and [decision 0011](decisions/0011-professional-briefing-workspace.md). It reorganizes existing evidence and controls without replacing data definitions or provider access. Local validation passed 171 tests (129 JavaScript, 42 Python), a static build, documentation-link checks and the desktop/responsive/output workflows recorded in the review. [Pages run 41357785947](https://github.com/xefensor/heli-briefing/actions/runs/41357785947) succeeded for application commit [`34bc26699f491953655302f631ab7854d46a780e`](https://github.com/xefensor/heli-briefing/commit/34bc26699f491953655302f631ab7854d46a780e). Public HTTPS loaded expected asset version `282f3afe1fd3df27aa95`, all eight forecast plots, six chapter links, three cameras and nine regional reports. Live source/comparison switching and a new saved full briefing passed; seven embedded images decoded in that preview. The review records exact local/public observations and their limits. The redesign is complete and live; the professional project still has the provider/licence/pilot/native-output gates listed in the release checklist.


## Browser-only feasibility prototype · 2 November 2026

The owner requires an ordinary-browser runtime without an extension, app or project data backend/collector. The new [decision 0012](decisions/0012-browser-only-runtime.md) supersedes the earlier target architecture; the existing main briefing still uses the previous snapshot implementation. This checkpoint publishes a separate source-verification prototype linked from the main footer, without silently removing integrated products from the main workspace. It is not a completed production conversion.

Local verification passed **199 tests (157 JavaScript, 42 Python)**, a **62-file static build**, documentation-link checks and whitespace checks. The versioned prototype uses relative module imports within the same content-versioned graph. Actual browser requests obtained six METAR, four TAF, one dated/expired SIGMET, a decoded 1000×500 satellite PNG, four confirmed radar images and a playing 2592×1944 official municipal camera. Exact times, partial coverage, source restrictions and export limits are in the [feasibility record](browser-only-feasibility-2026-11-02.md). A genuine AUTO cloud-type-slash report exposed and now has a tested ceiling-parser correction. [Pages run 41421408239](https://github.com/xefensor/heli-briefing/actions/runs/41421408239) succeeded for source commit `e958b6ca5c09f5a381560226e679dc9a2b5242a9`. Public HTTPS loaded asset version `ee89fa7f79e6bf6203d5` and its footer-linked browser prototype. Real direct requests from the Pages origin again returned six METAR, four TAF, one dated SIGMET, a decoded GeoColour image and four confirmed radar frames; the municipal camera played at 2592×1944 and advanced from 24.8 to 67.8 seconds. The feasibility record preserves the exact source times and limits. This verifies the prototype, not conversion of the main workspace.
