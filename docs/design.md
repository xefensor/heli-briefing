# Design brief

Status: recommendations for a fresh product · Updated: 2026-11-01

[Repository overview](../README.md) · [Product brief](product-brief.md)

The confirmed direction is a helicopter-focused briefing with rich data and graphs, few avoidable clicks, meaningful persistent source controls and real working data. The primary pilot prepares reports for others in South Bohemia. Develop a new design from the three research tracks, using the [pilot-authored original](research/original-site.md) as contextual evidence of possible needs and defects. Its features, order and workflow can change. ABS styling is optional. Exact layout, linked timeline, component system and application stack remain design choices.

## Synthesize the evidence into a new briefing

Use [pilot-needs research](research/pilot-needs.md) to propose task priorities, [aviation interface research](research/interface-references.md) to develop presentation and interaction, and [data research](data/sources.md) to establish honest capabilities. The original's astronomy, weather graphs, regional reports, SWL and print action are candidates to assess within that synthesis. A map, cameras or route context can be prioritized when the task and evidence justify them; absence from the original is not a reason to defer them automatically.

For each major feature, record whether to retain, rework, replace or defer it and why. Preserve the owner-requested graph depth and direct access to evidence without locking the design to four charts, two-day astronomy profiles, old reading modes or section order. Prioritize a coherent preparation flow over individual widgets. Treat output for other pilots as a product task; browser printing is one candidate, and any chosen output needs explicit briefing context and source/validity times. Source inspection found print intent but no custom print stylesheet, bespoke PDF generator or verified printing implementation.

## Design approach to evaluate

Build a coherent information environment whose controls describe a real place, source and time context. The goal is to make relationships easier to read, not to remove information until the page looks simple. Regional awareness, point weather and optional route analysis are different tasks that may share context; determine their priority before choosing a layout.

Use a helicopter instrument character through clear grouping, calibrated scales, legible numbers and restrained physical feedback on controls. Subtle edges and pressed states are a recommendation. Decorative cockpit instruments, large branding, fake screws, excessive glow and material effects that compete with data do not help establish purpose.

## Global controls and data scope

Persistent control scope is confirmed; the exact control rail and placement below are proposed.

| Candidate control | Intended scope | Important distinction |
| --- | --- | --- |
| Region/location, with optional route and alternates | Relevant forecast queries, spatial context, nearby reports/cameras and local calculations | Station reports keep their actual station. Moving the selected point does not turn airport weather into a landing-area observation. |
| Forecast model/source and comparison | Every forecast panel supported by that dataset; associated legend, coverage and source labels | It does not change METAR/TAF/SIGMET issuing authorities, camera sources or astronomy. Unsupported variables remain explicit. |
| Date/time or flight timing | Forecast validity selection, relevant route timing, TAF overlap and astronomical context | Latest observations retain their own times. Inspection time and departure/arrival time need not be the same control. |
| Graph horizon/range | How much data is displayed | Changing the visible range should not silently change the selected time or flight plan. |
| UTC/local display | Displayed times with an explicit zone | Absolute instants remain unchanged; raw aviation reports remain in their original time notation. |

A shared cursor or linked timeline is a research-derived proposal. If used, separate transient hover preview from deliberate selection and clearly show what selection affects. “Return to now” should have an explicit meaning. Do not create separate empty “Now” and “Planning” applications or let one undifferentiated timestamp imply that every source has the same validity.

## Information that should stay inspectable

The final scope must choose the core set; these are recommendations, not a claim that all are available from one provider.

- **Forecast development:** aligned graphs for surface wind/gusts, visibility, cloud layers or bases where supported, precipitation, temperature/dew point and pressure. Upper wind, vertical profiles and terrain context become important when the chosen job requires them.
- **Regional evidence:** radar/satellite, significant-weather products and warnings. A source switch should not erase a different authoritative product merely because it comes from another provider.
- **Station reports:** station identity, issue/observation time, age, validity and forecast change periods; original text alongside an optional interpretation. A compact overview should lead directly to evidence.
- **Cameras:** location, view direction where known and image timestamp. A loading failure, old image or reference image must not look live. Availability and reuse rights are unresolved.
- **Light:** dawn, sunrise, sunset, civil dusk and selected-date context. Evaluate lunar event times, phase/altitude information and profiles according to reporting and night-use needs, with supporting detail placed where it helps. Lunar fraction alone does not measure usable ground light.
- **Optional flight context:** route, terrain, timing and alternate comparison without making route entry a prerequisite for checking a region or location.

Do not hide the agreed core graphs behind “advanced” accordions. Use expansion for supporting explanation, dense tables or enlarged inspection. Conversely, showing the same readings in a large summary, chart footer and another panel can add bulk without adding evidence.

## Visual and interaction recommendations

- Use consistent source labels, units, scales and time axes so neighbouring graphs can be compared. Preserve absolute timestamps when a range crosses midnight or a UTC/local date boundary.
- Give colours stable semantic roles. Distinguish observed, forecast, selected and uncertain states through text or symbols as well as colour. Do not use green as a blanket flight approval. Model disagreement should remain visible rather than be averaged into false precision.
- Prioritize readable data density. Keep numbers and units together; show source and validity close to the values they qualify. Small metadata is useful only while it remains readable.
- Keep useful controls persistent without building a tall command panel. On mobile, test the remaining viewport, keyboard access, touch targets, screen-reader names and focus order. Sticky content must not overlap data or consume most of the screen.
- Scope loading and failure states to the affected product. Keep real older data only with a clear stale state. An empty successful response is different from an unavailable service. Never substitute sample data, another station or a nearby model hour without explicitly identifying the change.

## Interface research already inspected

These are observed documentation patterns and design interpretations, not instructions to copy a product. Official screenshots/manual pages were inspected; signed-in live workflows were not tested.

| Reference | Concrete pattern | Useful lesson | Tradeoff |
| --- | --- | --- | --- |
| [DWD FlugWetter manual](https://www.dwd.de/DE/leistungen/lf_03_flugwetter_app/flugwetter_app_bedienungsanleitung.pdf?__blob=publicationFile&v=2), pp. 75–83; [cross-section guide](https://www.dwd.de/EN/ourservices/aviation_lf_03_app/cross_sections.pdf?__blob=publicationFile&v=1), pp. 1 and 3 | Stacked meteogram sections; model/run in the header; linked route map, vertical profile and time selection; tap for exact values | Rich data can stay coherent through shared context and source metadata | Entry/type-selection screens add clicks; dense conventions require explanation. The guide is dated March 2025. |
| [Autorouter GRAMET interpretation](https://www.autorouter.aero/wiki/gramet/) and [official complete example](https://www.autorouter.aero/wiki/wp-content/uploads/2014/04/gramet_complete1.jpg) | Route distance, waypoint and UTC timing share an axis; terrain, clouds, temperatures, wind and trajectory share a cross-section; forecast reference time is retained | Display relationships instead of fragmenting every parameter into a card | The inspected illustrations are legacy examples. Their pressure/flight-level scale and old model-availability statements are not a specification for this product. A low-level helicopter profile would need its own scale and supported data. |
| [SkyDemon official manual](https://skydemon.aero/help?handler=Manual), pp. 40–43 and 46–47 | Main map plus lower route profile and adjacent report pane; route-related report retrieval; RAW/decoded access; map/profile linking; explicit weather animation controls | Connect spatial overview, vertical context and source evidence | Graphical summaries omit bulletin details; long-press/right-click interactions can hide discoverability. Personal condition colours must not be treated as universal minima. |

## Evidence boundaries and validation

User requests establish the need for richness and low friction; they do not select a final panel arrangement. The original establishes page content and print intent, not a validated preparation workflow or feature priority. Forum comments establish individual use cases, not population-wide preferences. Official product manuals show interface mechanics, not proof that those mechanics fit this preparation workflow. South Bohemia is the initial confirmed context; a HEMS-only audience has not been established. Offline use, alerts, saved locations and automatic assessments remain proposals or open decisions.

Before accepting a design, verify that a pilot can identify the selected place, forecast source and time context; compare the agreed graphs; find a report's station and age; distinguish a model from an observation; and inspect missing or conflicting data without reconstructing context. Repeat on the intended mobile/tablet sizes and with keyboard/screen-reader access. Record what was tested, what failed and what Xef accepted; do not report a proposed interaction as implemented or validated.


## Implemented readability pass · 1 November 2026

The owner explicitly requested further implementation and a substantial UI/readability correction. The revised workspace applies the existing interface research: DWD/Meteoblue aligned time panels, Windy-style consistent comparison context and a MAVIS-inspired station comparison. These are our implementation choices, not copied assets or measured usability results.

- Put the selected model's eight forecast graphs first, with full-width aligned rows and neighbouring title/selected values on desktop. The independently labelled ICON-D2 ceiling follows them.
- Use 16 px body text, 13–14 px supporting information, clearer headings and stronger text contrast. SVG plots use their intended display width with fewer mobile ticks instead of shrinking a 720-unit chart to an unreadable narrow display.
- Keep location, model and time in the desktop control rail; arrange the same controls in readable rows on narrow screens. Add direct section links without hiding core graphs or reports. Hash navigation preserves live/pinned context.
- Add transient pointer preview lines/readouts across the forecast charts without changing the pinned selection. Click/keyboard selection retains the shared selected hour.
- Enlarge the regional map. Present regional station evidence in a distance-sorted comparison table before full-width original/decoded reports. On mobile, TAF groups stack vertically and the station comparison can scroll within its own region.
- Retain source timestamps, bounds, missing states, datum labels, raw reports and saved briefing behavior. Add explicit warning/error styling for report states. No provider or weather derivation changed.

Selected local browser checks covered light/dark desktop, a 390 px iframe (375 px content plus scrollbar), all eight populated graphs, nine overview stations, model-comparison overlays, coordinated keyboard selection and section navigation retaining live mode. Narrow content width equalled scroll width. The new responsive geometry regression and existing suite passed (106 tests total). Pointer-hover behavior is implemented but was not independently exercised by the available browser controls. Actual pilot preparation, print/download completion and full accessibility review remain outstanding.

Publication: [GitHub Pages run 41319009695](https://github.com/xefensor/heli-briefing/actions/runs/41319009695) succeeded for application commit `3a5802224731b1757e14c281908e9c626445d9b5`. The public HTTPS page was inspected after deployment: all eight forecast graphs, nine station overview rows and the new stylesheet loaded; desktop content width matched scroll width.


## Implemented route-point workspace · 1 November 2026

[Decision 0009](decisions/0009-route-point-weather.md) implements the first optional route stage using all three research tracks. Add points from the existing regional/saved-point context; set departure independently and enter leg minutes directly. Use the shared main/comparison models, discrete wind/visibility plots, readable point cards and the existing map. No route is required for the main briefing, and none of its eight forecast rows or regional reports were removed.

Departure is copied once on creation and then remains separate from live inspection time. Unknown/invalid leg times leave downstream passages undefined; reordering clears timings and has undo. Supporting source-query/grid details can expand while core readings and validity/retrieval times stay visible. On narrow screens editors, model cards and actual-width plots stack without horizontal overflow. Full frozen HTML/text captures route evidence; compact METAR/TAF output stays focused on reports. Selected local/mobile/live checks passed with 149 deterministic tests. This does not complete terrain/continuous cross-sections, native output verification or pilot validation.


## Route sections and visual evidence · 1 November 2026

The final evaluation pass applies the same three-study principles to the remaining buildable gaps: original-resolution images in one action, actual camera age/direction/distance, a stable selected low-cloud frame with a mutually exclusive forecast map layer, and route sections that preserve model/time context. Forecast heights and Bpv terrain are separate; unavailable slots are not hidden by choosing another image. Source refresh and the live clock do not move the page or repeatedly replace the route inspector while it has keyboard focus. Full output embeds actual selected images and source warnings; the compact bulletin mode stays separate. A two-day calculated solar/lunar altitude plot restores inspectable night/day development without equating moon phase with ground illumination.

See [decision 0010](decisions/0010-route-section-and-visual-evidence.md) and the [release checklist](release-checklist.md) for current scope and remaining target-pilot acceptance. This supersedes earlier camera/route implementation gaps, not the need for real pilot validation.


## Professional workspace redesign · 1 November 2026

The owner requested a substantial review and a more professional interface after the complete evaluation build. The [audit](design-review-2026-11-01.md) records confirmed structural issues, the three-study reasoning, final layout, accessibility/refresh changes and validation boundaries. [Decision 0011](decisions/0011-professional-briefing-workspace.md) implements the six-chapter workspace and consolidated context controls while preserving all data and core graphs. This supersedes the previous two-column panel ordering, not the data/source contracts or need for intended-pilot validation.


## Direct browser source integration · 2 November 2026

[Decision 0013](decisions/0013-direct-browser-integration.md) integrates the owner-authorized compatible sources without removing the eight core plots or station rows. Partial source coverage stays close to reports, with links for unsupported stations. The SIGMET overview remains explicitly uncertain when the catalogue is incomplete. Prospective local history is labelled as partial rather than a complete imported archive. Original camera/chart identities remain compact source cards, and the municipal viewer is separate and opt-in. Its iframe survives age ticks, source changes and data refresh, then closes explicitly. Frozen output identifies embedded satellite data versus online-only radar/video and unsupported products. These are usability choices under the three studies, not pilot acceptance.
