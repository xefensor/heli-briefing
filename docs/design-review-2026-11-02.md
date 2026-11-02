# Weather workspace UI/UX review · 2 November 2026

Status: published as the v0.8 evaluation, with the deterministic/local/public browser evidence below. Final application commit `6fe655ac640f3814c6727affc56af43b64ad14af` and publication are recorded in [deployment](deployment.md); intended-pilot acceptance remains unverified.

[Design brief](design.md) · [Product brief](product-brief.md) · [Previous review](design-review-2026-11-01.md) · [Deployment evidence](deployment.md)

## Purpose and review boundary

The owner requested a substantial review of the website from UI, UX and all three research perspectives. The confirmed user remains a South Bohemian professional helicopter pilot preparing briefings for others. Rich data and graphs, few avoidable clicks, meaningful persistent source controls, readable presentation and an ordinary-browser runtime remain requirements. The pilot's exact operation, aircraft, minima and briefing cadence have not been established.

This review inspected the current repository guidance, three studies, design brief and implementation structure. It is a code and product audit, not a new pilot interview, independent accessibility certification or measured usability study. The findings below describe identifiable interface problems and design judgments; the acceptance tasks still require actual browser checks and intended-pilot observation.

Success means that a reader can scan the weather, compare models, inspect contradictory or missing evidence and prepare a briefing while retaining place, source, time and units. Reducing the number of graphs or hiding the main evidence behind additional modes would not meet the owner's requirements.

## How the three studies guide the pass

| Research track | Relevant evidence or documented pattern | Application in this pass | Limit |
| --- | --- | --- | --- |
| [Pilot needs](research/pilot-needs.md) | The structured helicopter research found use of multiple weather-source types. Qualitative rotary discussions raised cloud base, visibility/fog, precipitation, repeated navigation, screen space and preservation of the regional report list. | Keep the eight coordinated graphs and regional overview. Connect visibility/cloud readings directly to independent ceiling, imagery and original reports. Reduce repeated explanatory blocks rather than removing evidence. | The structured sample was US and HAA-heavy; forum roles are self-described and contributions are not representative. These findings do not establish operating limits or prove this layout suits the intended Czech pilot. |
| [Aviation interface references](research/interface-references.md) | DWD FlugWetter and Meteoblue show aligned time panels; Windy documents comparison within one place/time; HemsWX connects regional position to visual evidence; MAVIS demonstrates a report matrix; ForeFlight illustrates summary-to-detail progression. | Use consistent parameter colors and explicit model stroke styles, exact comparison readouts, a strong shared context, direct evidence links, and adjacent graph/map relationships. Use supporting disclosures for definitions and dense metadata while core weather remains visible. | These are public product documentation and illustration patterns, not authenticated current-service tests or measured usability evidence. They are references, not a specification to copy. |
| [Data sources](data/sources.md) and [integrity rules](data/integrity.md) | Products differ in units, height reference, coverage, chronology and transport. Main-model selection cannot change an issuing authority, observed camera frame or independently delivered ceiling product. A successful image load does not establish exposure time or warning completeness. | Keep source, units, model/run/validity and critical uncertainty close to each value. Separate main forecast from native MSL and processed AGL products. Consolidate duplicate diagnostics without concealing missing coverage or stale evidence. Preserve manual original-map status through display and output. | Transport access does not establish forecast accuracy, professional access, reuse permission, complete coverage or an operational approval. No new provider capability is claimed by this interface pass. |

The [pilot-authored original](research/original-site.md) remains contextual evidence of possible information and printing needs. Its order, control design and defects are not an accepted specification. The source recovery in [decision 0016](decisions/0016-further-browser-source-recovery.md) adds useful evidence but also introduces new presentation work; recovered products should not simply accumulate as equally weighted paragraphs and full-width cards.

## Findings and implementation direction

| Priority | Identified issue | Chosen direction | Information that must remain visible |
| --- | --- | --- | --- |
| High | Important ceiling evidence is distant from the cloud and visibility readings, below long report and image sections. | Move the ceiling/profile chapter immediately after the core forecast/map workspace, with both independent ceilings before the profile and daylight context. Add direct evidence links from relevant summary and chart readings. | The destination is a separate product, with its own height reference, source and valid time. |
| High | Repeated report and SIGMET warning paragraphs compete with the weather and can repeat the same failure or coverage message. | Present one concise status per feed, with detailed diagnostics in supporting disclosure. Keep the structured-warning uncertainty distinct from the successfully displayed map. | Stale/unavailable state, incomplete coverage, original retrieval time and the absence of a verified all-clear. |
| High | Every comparison parameter currently receives the same purple color; all three comparison cloud layers can share a color and dash. | Keep a parameter's color consistent across the main and comparison model. Distinguish model by solid/dashed stroke and explicit legend. Add exact comparison readings for the selected sample. | Both model identities, units, sample time, missing fields and actual disagreement. Model agreement is not an independent confidence score. |
| High | A station name resembles a report heading but acts as a button that changes the global forecast point. | Use an actual station heading and a separately named forecast-location action. Preserve overview-to-station anchors. | Station identity, distance, observation/issue time, report state and original bulletin. Reading a report should not accidentally select a new point. |
| High | The main selector's scope is ambiguous now that independent model-ceiling products appear on the same page. | Explain the scope of the main forecast model in concise language near the shared controls or forecast context. Keep place/model/time persistent. | Reports and imagery retain their source; native ICON-EU MSL and processed RUC/D2/EU AGL retain independent model/run/validity. |
| High | Ceiling source cards place extensive prose or dense hourly metadata between the main value, graph and regional map. | Align graph and map where space permits and stack them on narrow screens. Move secondary definitions and dense sample metadata into clearly named disclosures. Preserve disclosure state through normal refresh. Apply the same spatial/time relationship to native MSL and processed AGL. | Core value, units/datum, source, selected validity, model/run, stale/missing state and critical processing uncertainty. No interpolation or continuous coverage is invented. |
| Medium | Small text is used for timestamps, legends, table cells and other information needed to interpret data. | Raise the minimum size and contrast of data-adjacent text, improve table rhythm and increase touch target size. Recover space through layout and removal of repetition. | Readable numbers and units together, meaningful state labels and adequate keyboard focus. |
| Medium | Long full station cards can make the regional report chapter difficult to scan, even though a useful comparison table already exists. | Strengthen the overview and direct station inspection; consolidate shared interpretation guidance. Retain all stations and raw/decoded access. | Missing stations, report validity and exceptional CNL/NIL/expired states. Avoid requiring separate accordion interactions to see each basic station observation. |
| Medium | Camera explanations and repeated attribution take considerable space before the photographs. | Group shared guidance and keep compact per-camera source/time status beside the image, with one-action enlargement. | Location/direction, unverified exposure time, confirmed load time, original photo clock and source-specific attribution. |
| Medium | The original low-cloud unavailable state gives browser/CORS and file-saving mechanics substantial prominence in the normal briefing. | Keep a clear unavailable state and visible original-source/local-file actions. Place multistep import help in supporting detail. | Manual origin and filename-unverified validity after import, unknown issue/retrieval time, and the fact that imported frames do not update automatically. |
| Medium | Several levels repeat selected model/time and the same value without adding a new relationship. | Give the quick summary, exact chart readout and shared context strip distinct roles. Keep parameter definitions beside the fields they qualify. | Model, sample validity, retrieval and any unavailable run time remain distinguishable. |
| Medium | Sharing a viewing selection and capturing a briefing have different outcomes, but compact action labels can obscure the distinction. | Use task-specific action wording and concise help where output is prepared. Preserve the existing frozen-preview flow. | A shared link reloads data; captured output retains the selected evidence, notes and original clocks. Online-only images do not become captured imagery. |

## Continuous reading order

Retain one continuous workspace and six direct navigation anchors. The selected order is:

1. Main forecast development with nearby reports and regional map context.
2. Independent ceiling products first, followed by vertical profile and daylight context.
3. Regional report comparison and complete station evidence.
4. Visual evidence: original cameras, satellite/history and aviation maps.
5. Optional route preparation with its separate departure and passage times.
6. Briefing preparation, frozen preview and saved output.

This order brings cloud-height evidence closer to visibility, precipitation and cloud development without hiding the regional report list or requiring a new mode. A concise evidence-jump row near the initial summary and contextual links on cloud/visibility readings connect the relevant sections. The two ceiling products retain independent identity and datum rather than becoming extra fields of the main forecast model.

## Interface rules for implementation

- Retain all eight main forecast plots, source comparison, original reports, observation history, radar/satellite, original cameras, SWL/SIGMET imagery, both ceiling references, route context, astronomy and frozen output.
- Keep weather values and their critical interpretation available at rest. Supporting explanation, reuse notes and dense metadata may expand; warnings needed to interpret a value must not disappear into those disclosures.
- Use concise source/time strips rather than prose that mixes model run, forecast validity, observation time and retrieval. Unknown clocks remain unknown.
- Keep selected time deliberate. Pointer preview must not silently pin the live clock. Changing display timezone must not change the absolute instant. Main inspection time and route departure remain separate.
- Preserve exact missing values and model-specific coverage. A gray gap is not zero, a blank warning map is not an all-clear, and a nearby station is not a measurement at the selected off-airport point.
- Use color for parameter/model identity and information state with accompanying text, line style or symbols. No new universal flight categories or operating minima are introduced.
- Preserve independent product contracts: native ceiling in m MSL, processed ceiling in ft AGL, station ceiling above the reporting aerodrome, original low-cloud heights in hft AMSL, and cloud fraction in percent.
- Keep the ordinary-browser architecture. This pass does not add a project backend, CORS proxy, extension, deployment weather collection, private key or new external service.

## Verification tasks

The following are acceptance tasks for this iteration, not completed test results:

1. **Context and first scan:** on desktop, tablet and a narrow phone, identify selected point, main model, comparison, live/pinned time and timezone without opening settings. Confirm that sticky controls and navigation leave a usable reading area and do not obscure focus or anchor destinations.
2. **Model comparison:** select a comparison at one pinned time; inspect exact wind, visibility and cloud-layer readings. Confirm parameter colors remain consistent and model stroke style is unambiguous. Missing comparison fields must remain missing.
3. **Independent evidence:** follow direct cloud/visibility links to the correct product. Confirm that changing the main model updates applicable point/profile/route data while station reports, cameras and both independent ceiling sources keep their own identities and clocks.
4. **Regional reports:** use the overview to reach a station, read its source/age/raw text, then explicitly request a forecast for that station. The initial report inspection must not silently move the selected point. Check CNL/NIL/expired, missing-station and retained-cache states.
5. **Warnings and source failure:** inspect incomplete SIGMET coverage, a missing product and a stale retained feed. The concise visible message must retain the material uncertainty; supporting diagnostics must remain reachable. A loaded warning image cannot upgrade structured coverage.
6. **Graph/map relationships:** inspect native MSL and processed AGL value, graph, map, source and clocks. Check narrow stacking, legends, null values and selected pixel/cell marks. Expand secondary metadata, trigger a normal refresh and confirm that disclosure state and keyboard context are preserved.
7. **Images and manual evidence:** enlarge an original image and return focus correctly. Confirm camera load time is not labelled exposure time. Where authorized and supported, import an original low-cloud file and verify manual/unverified labels in the image, regional overlay and captured output. Record any environment restriction separately from a product failure.
8. **Output:** prepare a full frozen briefing and compact reports. Check context, source warnings, independent units/clocks, graphs/maps and original bulletins. Captured SVG/selected local image evidence must remain distinct from online-only camera, SWL, warning-map, radar and video links. Verify native save/reopen/print/PDF only if those actual events complete.
9. **Keyboard and display:** verify visible focus, readable labels, touch targets, dialogs, date/time entry, horizontal tables, anchor offsets and 320/390 px/landscape layouts. Check light and dark appearance and reduced-motion behavior. Do not describe these selected checks as a complete accessibility audit.
10. **Engineering and publication:** run the required application suite/build, check documentation links/whitespace, publish with the GitHub connector using a guarded non-forced ref update, and verify the actual public build and affected UI. Record test counts, asset/commit identity and observed limitations in [deployment](deployment.md).

## Evidence to append after implementation

Implemented the hierarchy and interaction changes under [decision 0017](decisions/0017-evidence-first-workspace.md). Core graphs and every station remain directly available. The native and processed graphs/maps pair on wide screens; the per-sample processed table and technical/import diagnostics are supporting disclosures. Native and processed graph keyboard actions now select the shared inspection time without relabelling either product.

Actual local checks on 2 November:

- **352 tests passed:** 310 JavaScript and 42 Python. The static build contains **65 files**, asset `d65c8915772ac2d3e9fe`, with no weather data directory.
- The 1363 px desktop viewport had matching **1348 px** body content/scroll width, all **eight** main graphs and **nine** station rows. Both light and dark appearances were inspected. Native and processed wide plot columns measured about **537 px** and **532 px**, respectively.
- ALADIN versus ICON-D2 displayed exact wind/gust, visibility and cloud-layer values outside hover. The three compared cloud layers retained their cyan/amber/purple parameter colours, with dashes identifying the comparison model. Keyboard selection retained the focused core plot and pinned the time.
- Processed-chart ArrowRight selected 17:00 CZ; after the actual request completed, the provenance disclosure remained open and chart focus returned. Native-chart ArrowRight subsequently selected 18:00 CZ. Each source retained its own model and height units.
- The station overview reached LKPR at about **111 px** below the viewport top, clear of the **91 px** sticky header, and focused its report section. The selected point stayed at 48.9463, 14.4294. Only the explicit forecast action changed it to LKPR at 50.1008, 14.2600; the base shortcut then restored the initial point. RAW text and conditional TAF groups remained visible.
- The **390 px** and **320 px** responsive frames had matching content/scroll widths of **375 px** and **305 px**, all eight plots and nine station rows. A narrow core graph rendered at **247 internal units and 247 actual pixels**, rather than scaling down a wider graph. The **768 × 420 px** frame had matching 753 px content/scroll width, eight plots, a scrolling header and a 20 px anchor offset; the measured sticky-header variable correctly became zero.
- Public follow-up identified lost focus after asynchronous briefing preparation. The corrected preview explicitly retains the invoking control; actual local Escape and close-button checks returned focus to `save-briefing`. Archive actions retain their own return target, with a visible preparation fallback when the original control is removed.
- A real camera enlarged to **1600 × 1200**; Escape returned focus to its original enlargement button. Exposure time remained explicitly unverified.
- Full frozen output retained **16 SVGs**, both independent ceiling regional maps and visible model comparison readings. Desktop content/scroll width matched at **1287 px**; phone output matched at **330 px**. It loaded **no remote images or iframes**. Compact output retained original reports and matched 1287 px. These are rendered preview checks, not completed native file delivery or PDF printing.

No repeated local-file selection was attempted after the earlier declined browser approval. This iteration preserves the existing local-map parser and manual/unverified distinctions; it does not turn the prior local import check into public-site acceptance. No actual pilot, screen-reader, physical touch or OS reduced-motion acceptance is claimed. Public commit/build evidence belongs in [deployment](deployment.md).

Final public HTTPS verification matched asset `d65c8915772ac2d3e9fe` and the final application commit, with eight plots, nine report rows, exact comparison readings, decoded warning imagery and both ceiling references. Public frozen output retained 16 SVGs and no remote image/iframe requests; final preview closure returned focus to its invoking header action. The deployment guide records the workflow and cache-aware build identity checks.

## Whole-project completion boundary

**The whole professional project remains incomplete.** This UI/UX pass cannot resolve automatic original low-cloud retrieval, direct native ICON-D2 MSL access, complete current structured FIR warning coverage, authoritative LKHS METAR/TAF availability, professional provider access and source-specific reuse/redistribution terms. Intended-pilot usability and intended-device native save/reopen/print/PDF acceptance also remain dependencies unless subsequently completed and recorded.

See the [release checklist](release-checklist.md) for the current delivered scope and acceptance procedure. Passing implementation tests or publishing this redesign does not establish source completeness, forecast skill, operating approval or the intended pilot's acceptance.
