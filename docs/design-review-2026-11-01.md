# Professional workspace review · 1 November 2026

[Design](design.md) · [Product brief](product-brief.md) · [Release checklist](release-checklist.md)

Scope: review and redesign the existing evaluation for a South Bohemian professional helicopter pilot preparing briefings for others. The owner requested a substantial UI/UX review and a more professional result. The layout and palette below are implementation choices under that instruction, not a claim of pilot acceptance or a universally best interface.

## Evidence used

All three studies were reread before implementation. This pass changes presentation and interaction; it does not introduce a provider, new aviation data or new operating rules.

| Study | Applied principle | Boundary |
| --- | --- | --- |
| [Pilot needs](research/pilot-needs.md) | Compare forecasts against identifiable observations; reduce repeated setup; preserve substantial graphs and original bulletins. | Qualitative accounts and other mission contexts do not establish this pilot's minima or measured usability. |
| [Aviation interfaces](research/interface-references.md) | Aligned meteograms, stable location/model/time context, a readable regional report list and spatial/vertical evidence with explicit legends. | Patterns were adapted; competitor screens/assets were not copied. |
| [Data sources](data/sources.md) | Independent products keep their own model, author, units, validity and source times; unsupported or failed data remain visible. | A visual redesign cannot supply professional access or missing observations. |

The pilot-authored original remains contextual evidence. It does not require its section order, approximations or redundant controls to be retained.

## Findings and resulting changes

| Priority | Finding / evidence | Implemented response |
| --- | --- | --- |
| High | The entire long forecast/media block preceded the regional report list; SIGMET was after cameras and astronomy. Confirmed in DOM order and the live-page review. | Add nearby station evidence beside the forecast, with distance, actual observation time, limits/ceiling identity and explicit gaps. Put a concise SIGMET status near the page context; retain full messages in the regional column. |
| High | Primary model/time were in the header, comparison in the forecast panel, zone/live state elsewhere. Mobile made the header static. | Keep location, primary/comparison models, viewing time, zone, live/pinned state and preparation accessible in the shared control bar. Use a compact responsive layout that remains sticky. |
| High | Ten equally weighted links had no current-location indicator. | Six task chapters: weather, regional reports, visual evidence, heights/light, route, handoff. Desktop rail and phone bottom navigation use direct anchors; no tab hides the eight core graphs. The active chapter follows measured content and recognizes the document end. |
| High | Print and preparation were prominent but produced different documents. | Make captured briefing preparation the primary header action. Keep native download/print in its reviewed preview. Label live-page printing explicitly and place it in the handoff section. |
| High | Refresh could detach focused imagery controls; whole-chart live announcements could repeat eight SVG subtrees. | Restore semantic imagery/modal focus, preserve chart focus across rerenders and announce one selected chart/time/value readout. Preserve astronomy/SIGMET disclosure state/focus. |
| Medium | A growing stack of override CSS made density, typography and breakpoints inconsistent. | Rebuild shared foundations in `styles.css`; retain domain-specific evidence styles in `workspace.css`. Use a restrained navy/blue-green palette, stronger type hierarchy, consistent borders/spacing and tabular numeric readings. |
| Medium | Cameras stacked vertically in the narrow companion column. | A dedicated evidence chapter displays three cameras across the desktop, with full source/time/direction and one-action enlargement. Satellite/history sit together; SWL and low-cloud retain original maps and distinct forecast labels. |
| Medium | Each report repeated long methodology around the same METAR/TAF concepts. | One visible shared interpretation guide; per-station METAR and TAF blocks sit alongside each other on desktop. Keep every period, unknown group, exceptional warning and RAW bulletin. Stack them naturally on phones. |
| Medium | Wrapped headers could disagree with fixed anchor offsets; bottom navigation could cover focused content. | Measure actual sticky header/navigation geometry and apply scroll padding. Preserve matching DOM/visual keyboard order at every layout. |
| Medium | Live minutes conflicted with an hourly native input step; theme names did not reflect restored state. | Use minute-valid input, keep nearest forecast-hour labels, and synchronize theme/zone/live accessible names with visible state. |
| Medium | The new overview needed its own initial-failure/retained-data states. | Explicit unavailable or stale-source text in nearby observations and the top SIGMET link; no permanent loading text after failure and no invented fallback readings. |

## Resulting reading flow

Start with a place, forecast source, comparison and viewing time. Read the selected model sample beside nearby station evidence, then inspect the eight aligned forecast plots. The full regional station comparison and original/decoded reports follow. Direct chapter links reach camera/satellite/history/chart evidence, the separate point/ceiling/light context, optional route and captured output.

Viewing time remains distinct from route departure and leg timing. Forecast selection does not rename METAR/TAF/SIGMET, camera, satellite, native-ceiling or astronomy sources. A nearby station remains a station observation, not a landing-area measurement. Native ceiling remains independent ICON-D2 MSL; terrain remains Bpv in its own section. Existing data, missing states and output snapshots are preserved.

## Validation record

Implementation checks and actual browser observations are separate. Source and deployment evidence are recorded in [deployment](deployment.md).

- Deterministic suite: 171 tests (129 JavaScript, 42 Python), including preserved TAF periods/unknown warnings/escaping in the compact layout and measured-position navigation boundaries.
- Static build and documentation links checked; original static control IDs and all core evidence hooks retained, with no duplicate IDs or broken static anchors.
- Actual browser checks: desktop content/scroll width matched at 1348 px; 768, 390 and 320 px responsive frames had no page overflow (753, 375 and 305 px usable widths). The 320 px header uses three readable context rows. Desktop anchor clearance followed the measured 86 px header, and the final chapter became active at the document end.
- Keyboard inspection kept focus on the wind graph, updated the exact hourly selection and announced its wind/gust values once. Camera focus survived repeated age ticks and returned after enlargement/close. Light and dark presentations were visually inspected.
- Source switching retained an independent comparison and explicitly identified the native ICON-D2 ceiling. A native disabled boot fieldset prevents control changes before handlers are bound; the source-change workflow passed after a fresh reload.
- A new frozen briefing saved to the browser archive and opened at 349 px without dialog overflow; its inner document was 330 px with no horizontal overflow. All seven embedded data images decoded, fourteen SVG plots were retained, TAF content remained present, and compact-copy feedback plus a 3,330-character clipboard payload confirmed the copy action. These checks cover the preview payload, not native file/PDF delivery.
- Real provider failures remain test evidence: the local report collection returned fresh METAR/SIGMET/radar while TAF refresh timed out and retained genuine older TAFs. Their own retrieval time and stale state remain visible. No replacement TAF was invented.

These checks do not establish full assistive-technology conformance or measured pilot task performance. Native download/PDF completion and intended-pilot/device acceptance remain the previously documented external checks. A successful redesign release does not select a project licence or configure professional provider access.
