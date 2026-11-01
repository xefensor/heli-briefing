# Roadmap

The repository began with documentation and now has a published v0.2 evaluation application. Later stages describe work and acceptance gates; their presence does not mean every proposed feature is complete. See [deployment](deployment.md) for dated test/browser/publication evidence and [decision 0005](decisions/0005-complete-briefing-data.md) for the implemented v0.2 scope.

## Current delivery status

- [x] Publish the first static evaluation on GitHub Pages and verify real ALADIN values, eight charts, ČÚZK map tiles and a timestamped ČHMÚ radar image.
- [x] Implement v0.2 automatic age/refresh monitoring with hidden/offline handling and retained inspection time.
- [x] Add independently labelled native ICON-D2 ceiling data with actual model/run/validity, missing-value handling and per-run ingestion caching; ingest 49 valid times and 6,693 regional native cells.
- [x] Add conservative structured METAR summaries, explicit TAF periods and twelve-hour station METAR history.
- [x] Add a two-hour, up-to-twenty-four-frame observed radar sequence with honest gaps.
- [x] Add frozen report preview, HTML briefing export and up to ten browser-local archives.
- [x] Pass 105 local tests and selected desktop/390 px browser checks; publish v0.2 successfully through GitHub Pages.
- [ ] Capture browser file-download completion and validate the preparation/output workflow with the intended pilot.

These additions preserve the substantial graphs, direct evidence access and coordinated controls. Appropriate professional production provider access and pilot workflow validation remain separate work. Integrated cameras and full vertical route profiles remain open scope. A point profile and one satellite product are implemented in the current extension below.

## Current extension

- [x] Add a model-coordinated six-level point profile with height/terrain masking and provider interpolation labels.
- [x] Add bounded timestamped EUMETSAT GeoColour imagery and enlarged inspection.
- [x] Include both in frozen output and open the preview when preparing a briefing.
- [x] Verify and publish the extension; see [decision 0006](decisions/0006-point-profile-and-satellite.md).

## Handoff refinement

- [x] Retain full briefing output and add a compact original-report pack.
- [x] Add captured-source review and plain-text/manual-copy handoff.
- [x] Refine the preparation area, preview controls and printable appendices.
- [x] Publish and record final browser/print-layout checks; see [decision 0007](decisions/0007-briefing-handoff.md).

The whole project remains **incomplete**. Check the remaining feature/access/validation items below; a finished iteration is not a claim that the product is fully complete.

## Point and time continuity

- [x] Add direct coordinate entry and named browser-local points in the global location selector.
- [x] Preserve live mode across reload while keeping copied inspection links explicitly pinned.
- [x] Publish and record final verification, including versioned application assets; see [decision 0008](decisions/0008-saved-points-and-time-continuity.md).

## Route-point briefing

- [x] Add up to six route points, independent departure and user-entered leg times with honest timing gaps.
- [x] Coordinate main/comparison models, native ceiling, discrete charts, map connectors and frozen full output.
- [x] Check timing/failure cases and selected desktop/mobile interactions locally.
- [x] Publish and record live verification; see [decision 0009](decisions/0009-route-point-weather.md).

Continuous weather/terrain sections and actual pilot validation remain separate open work.

## Foundation

- [x] Capture the owner requirements and separate recommendations from decisions.
- [x] Preserve pilot-needs research and interface references with source links.
- [x] Record provider access, capability, licensing and data-integrity constraints.
- [x] Add repository guidance, contribution guidance and documentation checks.
- [x] Establish the initial user/context: a South Bohemian professional pilot preparing reports for others, with the original as contextual evidence and the three research tracks guiding the rebuild.
- [ ] Resolve only consequential operation-specific details not established by available evidence; shift cadence remains tentative.
- [ ] Select the project licence and any required data agreements.

## Prove the data path

Choose representative checks: a South Bohemian base or point, a nearby off-airport location, a terrain-sensitive route, an international or domain-edge point, and a time near the end of each forecast horizon.

- Retrieve current official reports and selected forecast fields through documented interfaces.
- Demonstrate surface wind/gusts, visibility, cloud information and vertical wind/height where each model supports them.
- Ingest and label a native model-ceiling diagnostic without equating it with observed ceiling.
- Produce timestamped Czech radar and verify the source's geometry, legend and no-data mask.
- Preserve raw issue/run/validity metadata and demonstrate cancellation, NIL, missing, stale, expired and outside-domain states.
- Verify data reuse rights and attribution before adding redistribution or caching beyond the documented terms.

Acceptance: real source values, provenance, defined time/height references and honest gaps survive the complete path to a small display. A visually complete screen with substituted or invented fields does not pass.

## Validate the interaction model

- Synthesize pilot needs, aviation interface patterns and data capabilities into a coherent preparation flow with rich graphs, inspectable evidence and effective source controls.
- Assess major original features and proposed additions: retain, rework, replace or defer each with a brief task/evidence/data rationale. Do not require feature parity, the original section order or the same chart count.
- Compare a quick weather check, point inspection and an optional route briefing.
- Define how time selection differs from departure/passage time.
- Keep original reports and local evidence accessible with few repeated actions.
- Evaluate readable output for other pilots, with browser printing as one candidate; validate the selected output alongside desktop, tablet, narrow-screen, readable labels and touch/keyboard interaction.
- Use realistic missing-data and disagreement cases in the prototype.

Acceptance: a pilot can identify the viewing location, time, source, age and significant missing information without opening configuration. Compare sources without losing location or time. Agree the first-version layout before broad implementation.

## Select and implement the application

- Record framework, hosting, storage and ingestion decisions with reasons.
- Build provider adapters and shared data contracts before multiplying screens.
- Implement coordinated charts, map selection and original-report access.
- Include day/night presentation and relevant astronomy without implying ground illumination from moon phase alone.
- Add meaningful automated checks for the failure-prone transformations and product behaviours.
- Review provider errors, quotas, offline/stale behaviour, accessibility and performance.

Acceptance: the agreed workflows operate on real data; model changes update relevant panels consistently; source failures and unsupported fields remain understandable; no placeholder data is presented as current weather.

## Operational review and release

- Review the product with pilots from the actual first-version audience.
- Validate forecast processing against source outputs and observations; distinguish processing bugs from model forecast errors.
- Recheck provider terms, coverage, station availability and upcoming migrations.
- Define support, incident reporting, source outages, retention and release scope.
- Publish only the agreed application scope and retain clear provenance and limitations.

Formal operational suitability or approval is not established by a source being official or by this research. Any required assurance depends on the intended use and operator context.

## Questions to resolve

1. Which reporting cadence or operation-specific requirement materially changes the proposed preparation workflow? First use the existing evidence and ask the owner only about consequential gaps, one question at a time.
2. Which VFR/IFR, aircraft or night-use requirements need direct confirmation from the pilot?
3. What geography, regional report set and forecast horizon best support the confirmed South Bohemian preparation role?
4. Which raw datasets are worth direct ingestion, and where does an aggregator offer enough value?
5. Which camera, aviation-chart, NOTAM and airspace reuse agreements are needed?
6. Which additional backend/ingestion infrastructure is justified beyond the selected static GitHub Pages first build?
7. What project licence and release audience should apply?
