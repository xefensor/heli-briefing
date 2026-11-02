# Native cloud-height forecast

Current browser additions are in [decision 0016](../decisions/0016-further-browser-source-recovery.md): separately processed RUC/D2/EU ft AGL rasters coexist with [native ICON-EU m MSL](../decisions/0015-native-browser-recovery.md). They are not a native-D2 or terrain-conversion substitute. Earlier ingestion records below remain historical.

[Data catalogue](sources.md) · [Integrity requirements](integrity.md)

Checked and implemented on **2026-11-01**. This is a separate **DWD ICON-D2 CEILING** diagnostic; it does not inherit the surface-model selector's ALADIN or ECMWF label.

## What the value means

DWD's [ICON-D2 technical description](https://rcccm.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon_d2/icon_d2_dbbeschr_aktuell.pdf?nn=16102&view=nasPublication), §6.1, printed page 47, defines `CEILING` as the height **in metres above mean sea level** where scale/sub-scale cloud coverage first exceeds 50% when looking upward from ground, **excluding the convective contribution**. It is a model diagnostic, not measured ceiling, cloud-cover percentage, every cloud base, or a flight decision.

The application displays metres MSL. It retains matching native model terrain as provenance but does not silently subtract local terrain or label this diagnostic AGL. The native GRIB missing-value bitmap remains missing: an undefined diagnostic does not mean clear sky, CAVOK or unlimited observed ceiling. A genuine numerical zero or 9999-metre value remains a value when its bitmap says present.

## Data path and scope

The official [v1 CEILING catalogue](https://opendata.dwd.de/weather/nwp/v1/m/icon-d2/p/CEILING/r/) lists actual model runs. The collector chooses the newest run whose advertised hourly steps 0–48 are complete. It then reads native `CEILING`, `CLAT`, `CLON` and `HSURF` products for that run. It validates their GRIB identities, units, native grid UUID, cell count, model initialization and validity timestamps.

The regional crop covers **48.4–49.7° N, 12.9–15.7° E**. It preserves the actual approximately 2.1-km native cell centres and their ordering. Heights are rounded to one metre for transport; coordinates to five decimal degrees. No spatial interpolation, finer physical resolution or extra forecast hours are introduced. Browser inspection chooses the nearest native cell within 3.5 km and the nearest published hour within 30 minutes. It refuses coordinates outside the crop, gaps outside that distance and times outside the collection's horizon. The selected cell, distance and actual forecast hour remain available for display.

`scripts/update_clouds.py --cache-key` performs bounded catalogue discovery with Python's standard library, returning an identifier for the actual complete model run. The collector requires the pinned GRIB decoder in [requirements-clouds.txt](../../requirements-clouds.txt); that dependency is not loaded by the browser or deterministic tests. Ingestion uses at most four simultaneous product requests and a 3 MB limit per response. A complete run requires roughly 40 MB of native source data; the Actions cache retains only the assembled regional JSON, not full-domain GRIB intermediates. Identical cached runs retain their original retrieval time.

Network/format failure retains real previous content with its original retrieval/model times and a `stale` state when available; otherwise it produces `unavailable`. Expired runs, missing diagnostics, outside-region points and unsupported forecast times remain separate browser states. A model run older than nine hours receives an age warning, representing three nominal three-hour run cycles, not a legal or operator limit.

## Verification and rights

Actual v1 samples on 2026-11-01 returned the native ICON-D2 grid UUID `c6b12daa91ad64045b26c1b6452a2a20`, grid number 47, and 542040 cells for all four products. `CEILING` decoded as `ceil`, units `m`; native coordinates decoded as `tlat`/`tlon` in degrees, and terrain as `HSURF`, units `m`. These samples validate the processing path and the checked run, not forecast accuracy or uninterrupted future availability.

Source attribution is **Deutscher Wetterdienst · CC BY 4.0**, with [licence](https://creativecommons.org/licenses/by/4.0/) and the provider/product links retained in the data. See the [catalogue's DWD entry](sources.md#dwd-raw-forecast-data) for reuse conditions. Native-grid use avoids depending on the regular-latitude/longitude output scheduled for withdrawal after November 2026; future changes still require capability checks.
