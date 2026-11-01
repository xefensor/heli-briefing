# Build and publish

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

This first build is an open-source evaluation version using Open-Meteo's free hosted service within its applicable access terms. Its data licence and hosted API licence are separate. Professional/commercial production use needs the appropriate provider access; no paid service has been configured by this build.

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
