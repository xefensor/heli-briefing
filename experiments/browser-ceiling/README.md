# Browser ceiling experiment

Research checkpoint, **2 November 2026**. This is a reproducible experiment, not an application adapter or a completed native ICON-D2 integration. See [decision 0014](../../docs/decisions/0014-browser-source-gap-recovery.md).

The main application now uses a separate **small JavaScript native-grid decoder**, documented in [decision 0015](../../docs/decisions/0015-native-browser-recovery.md), with actual ICON-EU point, series and regional display. This older 41 MB WASM proof remains reproducible historical evidence and is excluded from deployment.

## Reproduce

From the repository root, run:

```sh
python3 experiments/browser-ceiling/setup.py
```

Then open **`/data/ceiling-proof/index.html` in the existing project preview** and select **Test actual browser fetch and decode**. Use the repository’s normal preview workflow; the experiment needs an HTTP origin and cannot run from `file://`.

The setup script downloads only two pinned software archives from the npm registry. It verifies their SHA-512 integrity before reading exact allowlisted members, runs no installation hooks and fetches no weather. It copies the authored page and worker plus decoder assets into `web/data/ceiling-proof/`, with local Git exclusion. The application build excludes all `web/data`; nothing adds this experiment to the main page, default build, dependencies or deployment workflow. Remove that generated directory to clean up. Downloaded archives are cached under ignored `.cache/browser-ceiling/`.

Only the user’s button starts provider requests. The worker discovers actual published nonfuture ICON-EU runs and actual CEILING keys through bounded public S3 listings, fetches one advertised time step, decompresses bzip2 and decodes GRIB2. The fixed public test coordinate is LKCS, 48.9464° N, 14.4275° E. Results show actual GRIB identity, initialization and validity beside the advertised object, nearest grid coordinates and a value in **metres MSL**. The worker is terminated after success or failure.

## What was verified

An actual ordinary-browser check fetched the 06 UTC ICON-EU run, valid 11 UTC on 2 November 2026, directly from the public Source Cooperative S3 bucket. It decoded 904,689 values and sampled grid point 48.9375° N, 14.4375° E: **2269.595600128174 m MSL**. The browser experiment completed in about **1973 ms**, with **115,998,720 bytes of WebAssembly heap**. That timing is one observation, not a performance guarantee. Source listing/object responses allowed the Pages origin through CORS.

The initial browser attempt exposed a bundler-specific bzip2 `require()` loader. Setup applies two small, explicit browser adaptations: preserve the supplied bzip2 `locateFile` callback, and expose the ecCodes wrapper through the worker rather than CommonJS. Pinned source-shape checks fail if either expected line changes. [Third-party notices](THIRD_PARTY_NOTICES.md) and the exact package licences accompany generated assets.

| Pinned software | Registry archive SHA-512 integrity | Actual artifact |
| --- | --- | --- |
| `@meri-imperiumi/eccodes-wasm@2.48.2` | `Z7rD3xInomPG7FS97ORD1UGKAdgeeRP9ofa9k4m8d+k2sDfDQeAjTzvs9UOndyaZovaSbEQeIoNX8gTmQNhiSA==` | 39,582,405-byte WASM; archive 6,819,088 bytes. |
| `@foxglove/wasm-bz2@0.3.0` | `MP18X3TbeoGT3Kfke7KrYin+5zESfcPnsdD2gaVviN1xzteoDDfVTZbVmbdfGrIV/qAAhBhBVbRcrN25rWSNOQ==` | 1,048,165-byte WASM. |

## Limits and next engineering decision

- This is **ICON-EU on its legacy regular grid**, not ICON-D2 or a native-grid sample. Keep the model and sampling distinction visible.
- The roughly 41 MB decoder payload, memory64 requirement and measured memory cost prevent treating this as a lightweight default. Intended Firefox/Safari/mobile compatibility has not been verified. A smaller decoder needs its own correctness and browser tests.
- The regular DWD distribution is due to end after **30 November 2026**. The future path needs the separately observed native ICON-EU archive. Metadata range requests verified matching CEILING, CLAT, CLON and HSURF objects: grid template 101, 768,608 cells, grid 62, UUID `832c1507fbc73eb384139890094d2c60`, packing 42. Those native fields were **not fully decoded in this experiment**. The native archive’s newest observed run was 00 UTC while the regular archive had 06 UTC; mirror lag must remain explicit.
- DWD defines this diagnostic as an MSL height where scale/subscale cloud coverage first exceeds 50%, excluding convective contribution. It is not an observed METAR ceiling, cloud fraction, convective cloud base or an AGL measurement. Do not subtract unrelated local terrain.
- No regional rendering, time series, production cache, continuous availability or forecast skill was validated. Errors remain visible; no prior or invented weather fills them.

The three studies support proving original quantities, source/time provenance and useful local sampling before adding another complex product to the workspace. This research does not complete the professional project or close its source-parity gates.

## Primary sources

- [Source Cooperative archive documentation and CC BY 4.0 attribution](https://source.coop/dynamical/dwd-icon-grib).
- [Native ICON-EU archive folder](https://source.coop/dynamical/dwd-icon-grib/icon-eu/icosahedral).
- [Public access without an account](https://docs.source.coop/create-an-account).
- [DWD ICON/EU manual, §6.1](https://www.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon/icon_dbbeschr_aktuell.pdf?nn=344870&view=nasPublication). The indexed primary extract was readable; direct PDF access returned 403 during this check.
- [Open-Meteo’s dated DWD distribution notice](https://open-meteo.com/en/docs/dwd-api). Its linked DWD announcement was not directly readable; the migration date is attributed to this notice.
- [ecCodes WASM package](https://www.npmjs.com/package/@meri-imperiumi/eccodes-wasm) and [Foxglove bzip2 package](https://www.npmjs.com/package/@foxglove/wasm-bz2).
