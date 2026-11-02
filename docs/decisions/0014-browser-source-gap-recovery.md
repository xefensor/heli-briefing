# 0014 · Recovering missing browser sources

Date: 2026-11-02. Status: implemented SWL display, supplemental reports/history and source links; ceiling decoder research is separate and is not integrated into the briefing. Publication and final checks are recorded in [deployment](../deployment.md).

**Subsequent implementation:** [decision 0015](0015-native-browser-recovery.md) adds inline original camera views and a small JavaScript native ceiling decoder. The large-decoder and missing-inline-camera conclusions below describe this earlier research checkpoint.

## Context and three-study review

The owner asked for further ways to display the products still missing after [decision 0013](0013-direct-browser-integration.md). The ordinary-browser constraint remains: no extension, native app, project backend/proxy or weather collection during deployment.

| Evidence | Applied decision |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Restore original charts and genuine observation trends, preserving provenance, cancellations, dates and visible gaps. |
| [Interface references](../research/interface-references.md) | Display recovered SWL inline, enlarge it in one action and keep location/model/time controls stable. Show the actual report provider beside its time. |
| [Data sources](../data/sources.md) | Distinguish browser display permission from readable pixels. Keep an alternate model and distribution service explicitly identified; do not relabel them as the original source. |

## Implemented recovery

### Original SWL via its official distributor

ČHMÚ's [SWL documentation](https://www.chmi.cz/files/portal/docs/meteo/olm/SWL_mapa_dokument.pdf) and the [ŘLP meteo homepage](https://meteo.rlp.cz/) advertise `swlmap.png`. The verified HTTPS URL is `https://meteo.rlp.cz/swlmap.png`: a 2339 × 1654 PNG, with ČHMÚ logo, MWO Praha attribution, original legend and UTC issue/validity in its header. The sampled map said issued 2 November 09:00 UTC and valid 12:00 UTC. These are sample observations, not hard-coded live metadata.

The host does not grant CORS pixel access. A normal `Image` can nevertheless display the actual PNG. The adapter restricts requests to this exact HTTPS path and a five-minute cache bucket, confirms decoded dimensions, and retains the last confirmed source URL and original load time after failure. The provider URL is mutable: retained metadata does not freeze its pixels, and a later image display can show changed content at that address. Request/load time never becomes forecast issue time or validity.

The main page displays the chart automatically at the full content width and provides an original-resolution enlargement. The unavailable low-cloud notice follows below it rather than consuming half the chart width. It explicitly asks the reader to check UTC validity in the map header; the shared forecast clock does not establish SWL coverage. Frozen HTML/text keeps source, load evidence and online-only limits, without automatically loading the remote map. Old embedded SWL archives remain readable. ČHMÚ authorship and [CC BY 4.0 website terms](https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti) are retained; this is not a blanket licence for unrelated ŘLP material.

### Missing Austrian reports and real initial history

The official [MET Norway Tafmetar interface](https://api.met.no/weatherapi/tafmetar/1.0/documentation) supplies dated XML for a preceding 24-hour window. Actual requests with the Pages Origin returned HTTP 200 and `Access-Control-Allow-Origin: *`: 325 METAR reports across eight requested stations and 36 TAF reports across seven. LOWL, LOWW and LKKV TAF were present. LKHS remained absent; LKCS had no TAF in that supplement.

`fetchBrowserAviation` keeps direct ČHMÚ SWIM as primary, including its old LKCS cancellation, and fills missing station rows from the separately identified supplement. Original TAC, full XML UTC dates and AUTO/SPECI/COR/AMD metadata are preserved and cross-validated. Correction priority precedes later transport timestamps. SIGMET remains the original explicitly incomplete SWIM inventory; METAR/TAF success does not establish warning completeness.

Real historical observations are merged with local observations, bounded to twelve hours, 400 records and the existing 750 kB cache. Missing periods are never generated. Restored reports from either provider remain unconfirmed until refresh, with their original individual dates. Failed primary retrieval cannot borrow a newer supplemental retrieval time or appear confirmed merely because the other provider succeeded.

The adapter uses two credential-free simple CORS requests, at least five-minute reuse and any later readable `Expires`. It does not add custom headers or a CORS proxy. MET Norway's [terms](https://api.met.no/doc/TermsOfService) permit low-volume simple browser requests identified by Origin; [licensing](https://api.met.no/doc/License) and provider credit remain attached. The provider documents a planned move to national SWIM distribution. Current international coverage is therefore a useful supplement with an explicit continuity warning, not a durable access guarantee.

### Exact camera views and warning-source links

The official camera replay still fetches JSON/base64 without CORS, while its pages forbid external framing. No current raw image route was found in its actual replay client or official open-data inventory.

The same three ČHMÚ views were found at In-počasí: [České Budějovice](https://www.in-pocasi.cz/webkamery/jihocesky/ceske-budejovice-186428055/), [Churáňov](https://www.in-pocasi.cz/webkamery/jihocesky/churanov-855413202/) and [Kocelovice](https://www.in-pocasi.cz/webkamery/jihocesky/kocelovice-533216231/). Each original card now has a direct alternate-viewer link. These links do not claim that our page has loaded a camera, verified its exposure time or obtained a supported camera embedding interface. The existing municipal viewer remains a separate opt-in source.

The SIGMET section also links the original [ŘLP SIGMET/AIREP map](https://meteo.rlp.cz/sigmetmap.png). The actual image had a 2 November 10:30 UTC update header. The separate `LK_sigmet.htm` response was empty with an October 26 modification date; neither that response nor an apparently empty map is promoted to proof of complete warning coverage.

## Still missing and the ceiling research boundary

The actual ČHMÚ low-cloud client still requests JSON/base64 without CORS. No raw image or permitted official embedded viewer was verified. ŘLP's ICON low-cloud-cover map represents cloud fraction, not the original BKN/OVC cloud-base product, and is not substituted.

Native ICON-D2 CEILING remains unavailable directly. A new investigation found a public, CORS-enabled [Source Cooperative archive](https://source.coop/dynamical/dwd-icon-grib) of **ICON-EU CEILING** with advertised S3 run/file listings. It is the actual ceiling parameter in metres MSL, rather than cloud fraction or convective base, but the model differs from ICON-D2. The sampled legacy regular-grid file was about 1.26 MB compressed and used GRIB2 CCSDS/AEC packing inside bzip2. The original DWD host's absent CORS is not changed by a decoder.

The exact file was decoded in JavaScript with `@meri-imperiumi/eccodes-wasm` 2.48.2 (Apache-2.0) and `@foxglove/wasm-bz2` 0.3.0 in an isolated experiment. An initial harness failed because the bzip2 package replaced the supplied browser asset resolver with a bundler-specific `require`; preserving the explicit resolver fixed that local packaging issue. The retest then fetched the actual S3 run listing and forecast file, decompressed bzip2 and decoded CEILING in the real browser, completing in 1,973 ms with a 115,998,720-byte WASM heap. This proof did not use local weather files, an extension or a data proxy. A run at 06 UTC, valid at 11 UTC, gave 2269.60 m MSL at the nearest regular-grid cell to LKCS. That is evidence of decoding the sampled model field, not a measurement or a new main-site capability. The tested decoder's uncompressed WASM asset is about 40 MB; its measured Node WASM heap was about 116 MB, with about 255 MB process RSS. The tested browser succeeded, but mobile/cross-browser compatibility, dependency packaging, production worker lifecycle, missing values, grid companions and time selection require their own verification before integration.

The regular-grid distribution also has a documented November 30 migration boundary. The [Open-Meteo DWD notice](https://open-meteo.com/en/docs/dwd-api) links the [DWD migration announcement](https://www.dwd.de/DE/leistungen/opendata/neuigkeiten/opendata_september2026_1.html); the announcement itself was not directly readable in this investigation. A production option must use the archive's [native-grid route](https://source.coop/dynamical/dwd-icon-grib/icon-eu/icosahedral) instead of depending only on the legacy rectangle. Actual bounded listing and 256-byte Range checks verified CEILING, CLAT, CLON and HSURF objects with CORS, grid template 101, 768,608 cells and the same grid UUID. The native sample was run 00 UTC while the regular-grid sample was 06 UTC, so archive lag must remain visible. These were header checks, not a full native-grid decode. Native files are plain GRIB2 and do not need bzip2. No native D2 product is relabelled, and no large decoder is added to the normal page load by this iteration.

The [reproducible source-only harness](../../experiments/browser-ceiling/README.md) preserves the experiment, pinned package integrity values, local setup and licence notices. Generated decoder binaries are excluded from Git and deployment. The persisted setup was executed successfully, and its regenerated browser harness repeated the same actual sample in 2,061 ms.

## Validation and completion

Actual local browser checks loaded the 2339 × 1654 SWL, its enlarged view and returned keyboard focus. All eight forecast graphs remained populated. LOWW displayed current METAR/TAF with MET Norway credit, and the LKCS history began with 24 genuine observations rather than a fabricated past. Source gaps, old cancellation and SIGMET uncertainty remained explicit.

Final tests, responsive/output checks and publication evidence are recorded in [deployment](../deployment.md). This iteration does not complete the whole professional project. Original embedded cameras, the original low-cloud map, native ICON-D2 ceiling, complete warning coverage, provider access and intended-pilot/native-output acceptance remain material dependencies.
