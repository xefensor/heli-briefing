# Point vertical evidence, GeoColour and preview-first handoff

Date: 2026-11-01

Status: implemented and published on GitHub Pages; verified 2026-11-01

## Context and decision

The owner requested continued work on missing capabilities and refinement after the readability pass. Add an altitude-qualified **point** profile, independent observed satellite context and a preview-first preparation action. These follow the existing pilot-needs and interface research; they do not establish a route planner, helicopter operating minima or pilot acceptance.

## Implemented scope

- Request temperature, humidity, wind speed/direction and geopotential height at 1000, 950, 925, 850, 800 and 700 hPa in the same explicit ALADIN/ICON-D2 query as surface forecasts. The selected point/model/time controls coordinate both. ECMWF IFS 9 km retains an explicit unsupported state.
- Validate per-field units. Mask all meteorological profile values when height or API terrain is missing, or the level is at/below that terrain. Keep missing horizons and real zero. Use MSL heights; no inferred AGL, cloud layers, freezing level, icing or terrain clearance.
- Mark ICON-D2 925/800 hPa as provider interpolation. Current [Open-Meteo DWD documentation](https://open-meteo.com/en/docs/dwd-api) explicitly documents this; [ALADIN documentation](https://open-meteo.com/en/docs/chmi-api) lists the selected levels. This resolves the previous documentation uncertainty about provider interpolation, without independently validating its algorithm.
- Collect one EUMETView `mtg_fd:rgb_geocolour` frame from the fixed WMS endpoint. Discover the advertised default UTC instant and request that explicit time. WMS 1.3.0 EPSG:4326 bounds use latitude/longitude axis order: `47,10,52,20`. The 1000×500 regional rendering is not native-grid numerical data. A returned image does not independently verify every pixel's acquisition time; the UI records the advertised/requested frame time.
- Bound capabilities/image sizes and timeouts; reject XML entities, future times, wrong products/extents and unexpected PNG geometry. Failure retains genuine previous imagery only when present and labelled stale; a fresh workflow without retained imagery emits unavailable. Generated satellite JSON is ignored by Git and collected before each Pages build. Browser checks use the existing five-minute snapshot refresh; collection follows the twenty-minute best-effort deployment schedule.
- Show geography labels, selected point, frame/retrieval times, age, source and attribution. A large modal keeps the image readable. GeoColour is cloud imagery from above; night imagery uses infrared composites over static NASA city lights. It is not local ceiling or visibility.
- Preserve the profile and embedded satellite in frozen briefing output. Preparing a briefing opens the frozen preview; download and print remain explicit actions there. Browser-local archives retain their existing ten-item/five-megabyte bounds, so larger snapshots can reduce retained item count.

## Access and evidence

The product-specific [EUMETSAT GeoColour catalogue](https://user.eumetsat.int/catalogue/EO:EUM:DAT:0913), checked 2026-11-01, states free/unrestricted CC BY 4.0 access and requires EUMETSAT/NASA credit. This product-specific catalogue is the basis for the regional image, rather than inferring rights from a generic web page or another satellite product. Credit, licence and the crop modification stay attached in the UI and exported document. [EUMETView WMS](https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetCapabilities&version=1.3.0) supplied the current product/time listing.

Actual small LKCS samples returned all thirty requested profile fields: 72 ALADIN samples and 61 ICON-D2 samples within requested 72-hour arrays. A 1000 hPa height below the API terrain was masked. The satellite sample advertised 2026-11-01 14:40 UTC; its regional PNG was retrieved and rendered with source credit. These observations establish those responses, not forecast accuracy or provider uptime.

Local validation: 119 tests (86 JavaScript, 33 Python), build and documentation checks passed. Browser checks showed six profile rows, an explicit unsupported ECMWF profile, a rendered enlarged satellite image and a frozen preview containing profile/satellite evidence with embedded PNG images and no scripts/external image URLs. A 390 px iframe had 375 px content plus a scrollbar and no page-wide overflow. The final stacked mobile table also retained equal content/scroll widths. ICON-D2 showed both interpolation labels. Publication requires its own recorded check.

## Remaining work

Full route/terrain cross-sections, cameras, integrated NOTAM/airspace, professional provider access, pilot workflow validation and actual print/download completion remain open. No new paid service, account, provider key or operational approval was configured.

## Publication evidence

[Pages run 41320741025](https://github.com/xefensor/heli-briefing/actions/runs/41320741025) successfully published the final application revision `5a3edb15bfc86604f67f5c9e4053c74bf4e0aabd`, following the main feature commit `d44b8b4da3628b3899b4fc962d2e41b8010f2577`. The public HTTPS page loaded eight forecast graphs, six ALADIN pressure levels and an embedded GeoColour image. Its satellite product time was 2026-11-01 14:50 UTC at the check, with its own age label. The preparation action opened a frozen preview in local browser QA, including both embedded radar/satellite images, profile content and no scripts or external image URLs. Browser file-download completion, printed/PDF output and pilot validation remain outstanding.
