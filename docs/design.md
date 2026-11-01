# Design brief

Status: recommendations for a fresh product · Updated: 2026-11-01

[Repository overview](../README.md) · [Product brief](product-brief.md)

The confirmed direction is a helicopter-focused briefing with rich data and graphs, few avoidable clicks, meaningful persistent source controls and real working data. ABS material styling is optional. No layout, linked timeline, component system, application stack or operational workflow is approved by this document. Previous redesigns are not the starting specification.

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
- **Light:** dawn, sunrise, sunset, civil dusk and selected-date context. Moon information may matter for some night operations; its priority depends on the operational scope.
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

User requests establish the need for richness and low friction; they do not select a panel count or graph arrangement. Forum comments establish individual use cases, not population-wide preferences. Official product manuals show interface mechanics, not proof that those mechanics fit the chosen helicopter workflow. The Czech/European research focus does not establish an exclusive geography or a HEMS-only audience. Offline use, alerts, saved locations and automatic assessments remain proposals or open decisions.

Before accepting a design, verify that a pilot can identify the selected place, forecast source and time context; compare the agreed graphs; find a report's station and age; distinguish a model from an observation; and inspect missing or conflicting data without reconstructing context. Repeat on the intended mobile/tablet sizes and with keyboard/screen-reader access. Record what was tested, what failed and what Xef accepted; do not report a proposed interaction as implemented or validated.
