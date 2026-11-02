# 0015 · Native browser ceiling and original camera recovery

Date: 2026-11-02

Status: implemented locally with actual browser checks; final suite and publication evidence belong in [deployment](../deployment.md). This supersedes the camera/ceiling implementation limits in [decision 0014](0014-browser-source-gap-recovery.md), not the remaining original low-cloud or professional-readiness dependencies.

## Context and three-study review

The owner asked us to “try more” and permitted practical workarounds. The existing constraint remains: an ordinary browser, without an extension, native app, project backend/proxy or deployment-time weather collection. This authorizes further source and decoder work, not weakening browser security or relabelling another meteorological quantity.

| Study | Applied choice |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Restore useful local evidence and actual cloud-height values; retain original source, datum, clocks and missing values. |
| [Interface references](../research/interface-references.md) | Show original camera views inline and make regional ceiling inspectable beside its time series. Preserve shared context while independent products keep their own identities. |
| [Data sources](../data/sources.md) | Use actual published image paths and a CORS-enabled native model archive. Validate the decoded field and grid instead of inferring weather from a successful request. |

## Decision

### Original camera views through a public image distributor

The three original ČHMÚ views now load as normal cross-origin images from the published In-počasí/Ventusky path convention. Only the exact camera IDs and fixed host/path patterns are allowed. Each camera tries the current UTC-hour file, then one preceding hour, then the advertised thumbnail. An image becomes available only after successful decoding with bounded dimensions; a five-minute cache bucket allows refresh without pretending the image is new.

The full-image hour filename is a mutable storage bucket, **not an exposure time**. Repeated checks of the České Budějovice file observed `Last-Modified` advancing from 11:10 to 11:40 UTC, while its burned-in camera clock advanced from 12:05 to 12:35 CZ. This disproves the earlier assumption that an hour file necessarily contains an hour-old fixed photograph. The application still leaves normalized acquisition time unknown and asks the reader to inspect the source clock.

ČHMÚ authorship, distributor identity, location, direction and original/alternate source links remain visible. No provider page is framed and no image pixels are read through canvas/CORS. Frozen output preserves links and the last confirmed load evidence, without automatically loading or claiming to embed these camera bytes. A mutable URL cannot guarantee identical retained pixels after failure.

### Native ICON-EU without the large WASM decoder

The production path uses the public Source Cooperative **native ICON-EU** archive, replacing the earlier legacy-grid experiment as the implementation foundation. It does not restore ICON-D2 or silently inherit the selected point-forecast model.

A 7,161-byte JavaScript AEC decoder and a bounded GRIB2 parser handle the actual CCSDS packing. There is no production ecCodes/WASM or bzip2 dependency. Native CLAT, CLON, HSURF and CEILING fields were compared against ecCodes: **3,074,432 decoded values across four 768,608-cell fields matched exactly**. The parser checks DWD origin, requested parameter/surface definition, native grid template and UUID, run/valid times, packing, lengths and bitmap alignment; unsupported forms fail explicitly. Adapted decoder code retains its upstream notices and licences.

A worker performs discovery, decoding and sampling. Initial loading requests six hourly slots; explicit expansion can request up to 24. At most two field requests run concurrently. The decoded-field cache holds at most fifteen fields—roughly 90 MiB of numeric arrays at this grid size, excluding temporary decode buffers—and keeps one matching coordinate/terrain set. Original per-frame retrieval times survive reuse; missing slots remain null. Requests and data are bounded rather than downloading an entire forecast horizon on page entry.

The selected point uses an actual nearest native centre within a stated distance bound. A regional crop carries actual centres and values; larger crops may use a declared subset of at most 2,048 centres. The checked South Bohemian view contained **985 actual centres**. The SVG shows dots, missing-value crosses, coordinates, nearby place labels, selected location/cell and a metre-MSL legend. It invents no interpolated polygons or continuous coverage. Frozen output can retain this SVG and its metadata without remote requests.

CEILING remains the DWD model diagnostic where scale/subscale cloud coverage first exceeds 50%, excluding the convective contribution. It is **metres MSL**, not AGL, observed METAR ceiling, cloud fraction or the original ČHMÚ low-cloud map. Model terrain stays separately identified; unrelated terrain is not subtracted.

## Alternatives and remaining limit

The previous roughly 41 MB WASM proof remains reproducible research, but is unnecessary for the supported production fields. A generic CORS proxy, extension or generated weather bundle would violate the owner constraint and is not introduced.

The exact ČHMÚ low-cloud widget was found at its public standalone route, but still returns `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'`. Its image API remains JSON/base64 without a compatible direct route. The new regional ICON-EU view is an independent product, not a renamed copy or claim of restored original-map access.

## Verification and completion

Actual local browser checks decoded all three cameras at 1600 px, displayed **3275.6 m MSL** from the native model, expanded six to twelve hours, and retained ICON-EU identity when the main forecast changed to ECMWF. Desktop content/scroll widths matched at 1348 px; the phone view matched at 375 px. Final deterministic checks, live publication and their scope must be recorded in [deployment](../deployment.md), not inferred from these local observations.

The whole professional project remains incomplete: original low-cloud access, complete warning coverage, provider/access agreements and intended-pilot/native-output acceptance remain open.

## Primary sources checked 2 November 2026

- [Published camera path convention](https://media.in-pocasi.cz/js/webcam/constants.js), [České Budějovice](https://www.in-pocasi.cz/webkamery/jihocesky/ceske-budejovice-186428055/), [Churáňov](https://www.in-pocasi.cz/webkamery/jihocesky/churanov-855413202/), [Kocelovice](https://www.in-pocasi.cz/webkamery/jihocesky/kocelovice-533216231/) and [ČHMÚ content terms](https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti).
- [DWD archive and licence](https://source.coop/dynamical/dwd-icon-grib), [native archive](https://source.coop/dynamical/dwd-icon-grib/icon-eu/icosahedral), [DWD model manual §6.1](https://www.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon/icon_dbbeschr_aktuell.pdf?nn=344870&view=nasPublication), [GRIB2 templates](https://codes.ecmwf.int/grib/format/grib2/templates/) and [AEC adaptation source](https://github.com/dmarkham/grib2/blob/146d5733902af5b41c45c7819b24079f7cdaebad/internal/aec/decode.go).
- [Original low-cloud explanation](https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti) and [actual standalone widget](https://www.chmi.cz/widget/web/chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti/-/ChmiMapComponent_INSTANCE_wchh).
