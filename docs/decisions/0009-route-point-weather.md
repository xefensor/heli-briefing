# Route-point weather and independent departure time

Date: 2026-11-01

Status: implemented locally; publication verification pending

## Context and three-study review

The owner requested continued development and UX refinement, checking all three studies every iteration and explicit whole-project completion reporting. This iteration implements a bounded first stage of route briefing. It does not claim a continuous weather/terrain cross-section or pilot validation.

| Study reviewed | Consequence |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Off-airport point selection, changing conditions along a flight and preparation for others support inspecting several places at planned passage times. The proposed timing workflow still needs the intended pilot's review. |
| [Interface references](../research/interface-references.md) | Coordinate map, timing, model comparison and directly readable evidence. Borrow the relationship between geography and time, without imitating a full EFB or adding mandatory route entry. Preserve all eight existing point graphs and regional reports. |
| [Data sources](../data/sources.md) | Use the existing explicit-model point adapter and independent native ceiling crop. Preserve per-point model, requested/grid coordinates, hourly sample time, retrieval time, missing run time, gaps and the native MSL reference. Point samples cannot establish conditions between points or terrain/obstacle clearance. |

## Current primary-source recheck

Checked 2026-11-01: [Open-Meteo forecast documentation](https://open-meteo.com/en/docs) and [terms](https://open-meteo.com/en/terms). The documented coordinates are WGS 84; returned grid coordinates can differ from requested coordinates. Gusts are maxima and precipitation sums for the preceding hour. Free hosted access remains non-commercial with published limits. This iteration keeps the existing evaluation access path and fields; it does not establish professional/commercial production access. No private key, subscription or new data provider was added. Existing model-specific field availability and DWD visibility migration caveats continue to apply.

## Decision

- Add an optional route workspace after the regional reports, with a direct section link. Keep the original forecast graphs and header controls in place.
- Add up to six user-selected points from regional shortcuts, saved points or the currently inspected map/coordinate point. Point coordinates are saved to five decimal places, as in saved-point navigation; this is storage precision, not location accuracy.
- Initialize departure once from the inspection instant (to minute precision), then keep it independent. **Teď**, live updates and moving the main chart time do not change route departure. A labelled button explicitly copies the inspection time when desired.
- Require integer leg durations of 1–600 minutes. Leave them blank until supplied; do not invent ground speed or an ETA. A missing/invalid duration leaves all later passage times undefined. Reorder/removal clears durations rather than applying old timings to new legs; immediate undo restores the previous plan.
- Show two discrete point-comparison charts (wind/gust and visibility), directly readable weather cards and exact planned passage versus selected hourly sample times. Do not interpolate or join weather between points. A missing hour more than thirty minutes from passage is unavailable rather than inherited from a distant hour.
- Use the global main and optional comparison models consistently. Keep the separate ICON-D2 CEILING crop independent of both. Core weather values stay visible; exact-query/grid details are supporting disclosures. Show run time as unavailable when the ordinary API does not provide it.
- Draw dashed point connectors and circle markers on the existing map, with a fit-to-route action. Distances are great-circle distances between entered points; the connector is a planning illustration, not an airspace/terrain/obstacle-checked route. Do not add dependency on unbundled Leaflet marker icons.
- Inspecting a route point opens the existing point forecast at its passage time when defined. Route departure remains unchanged.
- Save the plan locally under a versioned key, independently of cached weather. Unreadable/unsupported storage is not overwritten; storage denial leaves a temporary editable plan with a visible explanation. A shared inspection link still contains only the main point/time context; it does not silently claim to include the route.
- Freeze route plan, exact selected values, gaps, source times and native ceiling metadata into full HTML and text output. Keep METAR/TAF-only output scoped to its original reports. Existing saved briefings without routes remain supported. Validate captured coordinates, models, schedule and sample timing before rendering an archived route.

## Requests, failures and UX

Use the same model/coordinate-scoped forecast client and its ten-minute fresh/six-hour maximum stale cache. Deduplicate repeated coordinates per model and allow at most two simultaneous route requests. Do not request points with unknown passage times. Rate limits stop the queued work and preserve Retry-After; subsequent route refreshes respect a cooldown of at least one minute. Context changes abort obsolete requests; sequence guards prevent old results from overwriting a new route/model context.

Keep typed leg inputs stable while recalculating. Update their plan values immediately and debounce additional retrieval, so tabbing between inputs does not lose focus or require a separate apply action. Invalid departure hides route weather and blocks capturing it until corrected. On narrow screens stack editors/cards, retain readable axis geometry and keep controls inside the viewport. Source status is evidence availability, never flight permission.

## Validation

- All 149 deterministic tests passed (115 JavaScript and 34 Python); the static build contains 32 files. New checks cover midnight/DST, unknown/invalid timings, coordinate/model mismatches, null/zero, absent-hour gaps, stale data, bounded/deduplicated requests, rate limits, cancellation, escaping and archived-route context.
- Local browser: entered Planá–Kvilda with 25 user-supplied minutes; passage 2 November 07:25 CZ selected the explicitly labelled 07:00 hourly sample. Real ICON-D2 and ECMWF values differed and remained separately labelled. Main **Teď** changed the inspection clock without changing departure.
- Invalid departure hid the route values, and correcting it restored the actual samples. Invalid fractional duration removed downstream times. Reordering cleared durations, and undo restored the previous 25-minute plan. The existing map contained one dashed connector and two route circle markers.
- Switching main model to ALADIN immediately changed route source labels/loading states without relabelling retained ECMWF comparison data. Publication/live confirmation remains pending.
- 390 px mobile QA (375 px document): route-data client and scroll widths both 321 px; both SVGs used a 321-unit width. Editor controls were visually checked. This is selected browser QA, not a complete accessibility/device assessment.
- Frozen preview included both route point cards. Copied full text included plan/source times and selected values; compact report output contained no route cards. Native download completion and browser print/PDF saving remain unverified.

## Whole-project status

The whole project is **not complete**. This delivers route-point timing/weather, while continuous route/terrain/vertical sections, integrated cameras, authorized aeronautical feeds, professional provider access, pilot workflow validation and remaining native output checks are open. No operational approval or local forecast-skill validation is claimed.
