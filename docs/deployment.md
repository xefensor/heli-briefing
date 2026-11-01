# Build and publish

[Documentation index](README.md) · [Hosting decision](decisions/0004-github-pages-first-build.md) · [v0.2 data scope](decisions/0005-complete-briefing-data.md)

The first evaluation version is [published on GitHub Pages](https://xefensor.github.io/heli-briefing/). Static source lives in `web/`; generated deployment output lives in ignored `dist/`. The browser application/build has no npm installation step or application framework dependency. Native GRIB ingestion uses separately installed, pinned Python decoder packages.

Publication was confirmed on **2026-11-01**: [workflow run 41315499572](https://github.com/xefensor/heli-briefing/actions/runs/41315499572) completed its build and deployment for source commit [`51e42778f2d5bfd4f36db30c771db85fdf9adeb3`](https://github.com/xefensor/heli-briefing/commit/51e42778f2d5bfd4f36db30c771db85fdf9adeb3) and returned the live URL above. The live check confirmed real ALADIN values, eight rendered charts, ČÚZK map tiles and the ČHMÚ radar image. The deployed aviation snapshot carried a 14:18 UTC retrieval time. This is the verified v0.1 baseline; v0.2 changes below remain in progress until their own tests and deployment are recorded. Pilot usability remains unvalidated.

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

## v0.2 runtime behaviour being implemented

- While the page is active, a thirty-second tick updates ages. Forecast requests are due every ten minutes and report/radar/cloud snapshot checks every five minutes. Hidden/offline pages pause network activity and check again on return. A pinned inspection time is retained across refreshes; a live viewing mode may advance with the clock. Polling more often does not make the deployment snapshots newer.
- The native cloud layer comes from DWD ICON-D2 `CEILING` on its native mesh, cropped to the documented South Bohemian region. Its own model/run/validity remains visible even when another point-forecast model is selected. Values are metres MSL for the nonconvective greater-than-50% cloud diagnostic, not observed ceiling. Missing native values remain undefined and must not be labelled clear sky.
- Structured METAR summaries preserve missing fields, visibility bounds and raw text. TAF change periods are displayed explicitly rather than flattened into an overall permission to fly. A twelve-hour METAR history remains tied to each reporting station and actual observation time.
- The radar sequence holds up to twenty-four observed frames over two hours with acquisition times. Missing frames or incomplete history remain explicit. Animation does not imply a radar forecast.
- A frozen HTML export captures the current briefing context and available data without making later live requests. Up to ten local archives are intended for the same browser; local storage is not an account or server backup. Preserve source/run/validity/retrieval metadata and missing-data states in exports.

These are v0.2 implementation targets. Update this status only after the corresponding checks and deployed behaviour are confirmed.

## Provider access before professional production

This first build is an open-source evaluation version using Open-Meteo's free hosted service within its applicable access terms. Its data licence and hosted API licence are separate. Professional/commercial production use needs the appropriate provider access; no paid service has been configured by this build.

Any future paid API credentials need a server-side adapter or ingestion service. GitHub Pages cannot keep a key private in JavaScript, environment-generated client files, query strings or local storage. Changing the forecast adapter should preserve model identity, field capabilities, timestamps and honest failure states.

See [data sources](data/sources.md) for provider terms and [data integrity](data/integrity.md) for interpretation requirements.
