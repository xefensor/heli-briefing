# Roadmap

The repository starts with documentation. Later stages describe proposed work and acceptance gates; their presence does not mean implementation is complete.

## Foundation

- [x] Capture the owner requirements and separate recommendations from decisions.
- [x] Preserve pilot-needs research and interface references with source links.
- [x] Record provider access, capability, licensing and data-integrity constraints.
- [x] Add repository guidance, contribution guidance and documentation checks.
- [ ] Resolve the primary operating context and geographic scope for the first version.
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

- Sketch a regional overview with visible detailed graphs and source controls.
- Compare a quick weather check, point inspection and an optional route briefing.
- Define how time selection differs from departure/passage time.
- Keep original reports and local evidence accessible with few repeated actions.
- Validate desktop, tablet and narrow-screen behaviour, readable labels and touch/keyboard interaction.
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

1. Which first-version workflow dominates: a regional shift overview, local flight checks, route exploration or a specific mission briefing?
2. Which operation types, VFR/IFR contexts and night-use needs must the first version cover?
3. Which geography and forecast horizon are essential?
4. Which raw datasets are worth direct ingestion, and where does an aggregator offer enough value?
5. Which camera, aviation-chart, NOTAM and airspace reuse agreements are needed?
6. Which application stack and hosting can support the validated data path?
7. What project licence and release audience should apply?
