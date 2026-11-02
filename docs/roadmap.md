# Roadmap

The repository began with documentation and now has a published evaluation application. Later stages describe work and acceptance gates; their presence does not mean every proposed feature is complete. See [deployment](deployment.md) for dated test/browser/publication evidence and [decision 0005](decisions/0005-complete-briefing-data.md) for the implemented initial v0.2 scope.

## Current delivery status

The current evaluation provides coordinated forecast and comparison graphs; point/route vertical weather profiles; separate ČÚZK terrain; genuine regional reports/history; radar/satellite; three original camera views with unverified exposure times; direct SWL and SIGMET/AIREP imagery; optional local original low-cloud maps; separate native MSL and processed AGL ceiling products; astronomy; saved places; notes and frozen full/compact output. Automatic original low-cloud retrieval and complete structured warning coverage remain unresolved. See [decision 0010](decisions/0010-route-section-and-visual-evidence.md), [browser source recovery](decisions/0016-further-browser-source-recovery.md), the [release checklist](release-checklist.md) and [deployment evidence](deployment.md).

- [x] Build the complete bounded evaluation scope, with source/datum/time validation and honest failures.
- [x] Preserve substantial graphs and original evidence while refining readable desktop/mobile controls.
- [x] Prepare operational support/outage/retention guidance and the intended-pilot acceptance script.
- [ ] Complete the intended pilot's preparation/output acceptance on their actual devices.
- [ ] Configure professional provider access appropriate to actual use and authorized aeronautical redistribution where requested.
- [ ] Obtain the owner's project licence decision.

The whole professional project remains **incomplete** at these external gates. Do not treat the historical stages below as a requirement to repeat completed engineering or add every research proposal. Native file-save/print verification must retain the actual evidence and environment limitations in the deployment guide.

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
