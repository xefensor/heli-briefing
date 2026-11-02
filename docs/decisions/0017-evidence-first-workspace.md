# 0017 · Evidence-first workspace refinement

Date: 2026-11-02

Status: published as the v0.8 evaluation in final application commit `6fe655ac640f3814c6727affc56af43b64ad14af`. Actual checks and publication are recorded in [deployment](../deployment.md); intended-pilot acceptance remains open.

## Context

The owner requested a substantial UI/UX review against all three studies. Successive browser-source additions preserved useful evidence but made critical ceiling information remote, repeated source prose dominant, and model comparison difficult to inspect without hovering. The [dated review](../design-review-2026-11-02.md) records the concrete findings, research boundaries and verification tasks.

## Decision and research connection

| Evidence | Interface decision |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md): rich connected evidence, low navigation overhead, cloud/visibility/rain relationships and sparse off-airport observations. | Keep all eight primary graphs, every station and original report. Bring independent ceilings directly after the main forecast and link cloud/visibility readings to them. Provide direct radar/report/camera/map access from the first scan. |
| [Interface references](../research/interface-references.md): DWD/Meteoblue aligned plots, Windy consistent comparisons, MAVIS regional reports and HemsWX local evidence. | Coordinate place/time without conflating source identities. Use the same parameter colour in both models and solid/dashed strokes for model identity. Show both models' exact selected values. Align each ceiling time plot with its regional plot on wide screens. |
| [Data sources](../data/sources.md) and [integrity](../data/integrity.md): separate retrieval, validity, run, coverage and height datum. | Distinguish missing coverage, incomplete refresh and retained evidence. Preserve all essential uncertainty beside the product; move detailed diagnostics and technical provenance into stable disclosures. Keep native MSL and processed AGL independent. |

The continuous reading order is forecast, ceiling/profile/light, regional reports, visual evidence, optional route and output. Six direct navigation anchors remain. Existing product and station anchors remain valid. Core graphs, maps, observations and raw bulletins do not require individual accordion openings.

A station name is a heading. Its report-table link inspects evidence without moving the forecast point. A separate explicit action changes the forecast location. The share action identifies a place/time link; the briefing action captures available data. Main-model scope is stated concisely beside the initial context.

Typography and targets are strengthened, parameter comparison remains visible on touch/keyboard devices, and direct hour steps supplement the existing range/date controls. Core, native and processed time plots share deliberate global-time selection. Supporting source disclosures preserve expansion and focus during replacement. Short landscape screens let the header scroll so the reading surface remains usable; anchor offsets use actual sticky height.

## Tradeoffs and boundaries

The page remains information-rich and long. Direct task/product links, stronger hierarchy and compact supporting detail reduce repeated navigation without removing evidence. An explicit forecast-location action adds a labelled control to avoid a more consequential accidental context change.

Disclosures contain secondary sample tables, import mechanics, detailed methodology and diagnostics. Product identity, units, selected validity/run/load clocks, stale/manual/coverage warnings and unknown AGL conversion remain visible. Full frozen source output retains its detailed metadata and both independent references. Colours do not encode flight approval or universal minima.

No provider route, cache budget, decoder algorithm, source right, professional-access status or runtime architecture changes. GitHub Pages continues to serve code/assets only. No weather snapshot, proxy, extension or arbitrary network workaround is introduced.

## Verification and remaining work

Verify exact comparison values and missing fields, station inspection versus explicit location change, source-clock separation, keyboard/time/disclosure continuity, 320/390/tablet/landscape geometry, light/dark readability and frozen full/compact output. Actual deterministic/browser/publication evidence belongs in [deployment](../deployment.md), rather than being inferred from this decision.

**The whole professional project remains incomplete.** Source coverage/access, automatic original low-cloud, native D2 MSL, intended-pilot acceptance and intended-device native save/reopen/print checks retain the dependencies in the [release checklist](../release-checklist.md). This design decision establishes neither local forecast skill nor operational acceptance.
