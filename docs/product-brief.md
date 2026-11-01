# Product brief

Status: planning baseline · Updated: 2026-11-01

[Repository overview](../README.md) · [Design brief](design.md)

This repository is a fresh start. Xef discarded the original site and previous redesigns as product directions. Earlier code, layouts and control schemes are not an accepted specification. Research remains evidence to evaluate; it does not make a proposal a decision. This phase records requirements and plans before implementation. No application stack has been selected.

## Xef-confirmed requirements

| Requirement | Consequence for the product |
| --- | --- |
| The audience is helicopter pilots. | Design around their information needs; identify the operation type before encoding a particular workflow. |
| Rich data and graphs are essential. Previous versions removed or hid too much. | Preserve useful information and relationships. Do not equate better UX with fewer data or fewer graphs. |
| Access should require few avoidable clicks. | Core briefing information should be directly inspectable; important information must not disappear into layers of navigation. |
| Source controls should persist and affect all relevant forecast panels. | A model/source change must consistently update the forecast context across the page. It must have a visible effect and a clear scope. |
| The header needs to be meaningful. | Make the selected place, source and time context easy to understand and change; it should do more than hold branding. |
| The visual theme should suit helicopters. ABS plastic is not required. | Develop a purposeful aviation instrument character without treating a particular material effect as a requirement. |
| The data must actually load and work. | Use real available products; show missing, failed and stale data honestly. A convincing mockup is not completion. |
| Start again and document the research and decisions. | Do not silently carry forward rejected layouts or claim earlier proposals were approved. |

“Source controls affect all relevant forecast panels” does not mean a model selector changes the issuing authority of METAR, TAF, SIGMET, cameras or astronomical calculations.

Persistent controls means that the relevant context remains available across panels. Remembering preferences across visits is a separate, unresolved persistence decision.

## Proposed product jobs and priorities

The following is a working recommendation, not an approved feature list or order. A pilot should be able to begin with a region or location; a route should be optional until the primary job is established.

1. **Get a regional weather picture.** Understand the current observations, significant weather, precipitation and developing trends around the area of interest.
2. **Inspect a chosen location and time.** Read observations alongside forecast development: wind and gusts, visibility, cloud information, precipitation, temperature/dew point and pressure. Identify whether a value belongs to the selected point, a model grid or a reporting station.
3. **Explore a flight context when needed.** Compare times, an optional route, destinations and alternates. A nearby airport is a source of regional evidence, not automatically the weather at a landing area.
4. **Inspect the evidence.** Reach original METAR/TAF/SIGMET text, decoded reports, graphs, maps and relevant cameras without rebuilding the same context in each view.
5. **Understand available light.** Show sunrise/sunset and civil twilight for the selected place and date, with night context where relevant. These are calculated facts, not permission to fly.

“Now” and a future time are viewing or flight contexts within the same product. They are not a decision to create two separate, sparsely populated applications. A linked timeline is one possible interaction pattern; Xef has not approved it as the final solution.

## Decisions still required

- Primary job: briefing an already chosen flight, deciding a route/time, or maintaining awareness during a shift.
- Initial operation types: local/private/training, commercial work, transport, HEMS or another mix; VFR/IFR and night/NVIS needs.
- Initial geography. Research currently emphasizes Czech and European services; a Czech-only or regional HEMS-only product has not been accepted.
- Which controls belong in the global header, and whether inspection time, departure time, arrival time and graph horizon need separate representations.
- Which products are available with sufficient coverage, metadata and reuse rights; what remains an official-source link until an agreement exists.
- Route/terrain/alternate depth, offline or exported briefings, saved locations, accounts, alerts and any operational integration.
- Application stack, hosting, persistence, authentication and delivery scope.

Do not resolve these by assuming that every helicopter operation resembles an airline, HEMS base, US low-altitude service or recreational VFR flight.

## Proposed acceptance criteria

These are testable planning criteria to refine with the chosen product scope. They do not assert that an implementation exists or passes.

1. **Coherent context:** changing place or model updates every applicable forecast panel and its labels. Responses from the previous place cannot appear as current data. Observations, official reports and calculations retain their own sources.
2. **Useful detail with low friction:** the agreed core graphs and readings can be scanned without opening separate modes or repeated selectors. Exact values and original reports remain accessible. A user can start without entering a route.
3. **Time honesty:** every observation has a station and observation time; every forecast has its validity and available run/issue metadata. Refresh time is separate. Current, inspected and flight times are distinguishable, including across UTC/local dates and daylight-saving changes.
4. **Data honesty:** missing values, an empty valid response, loading, stale retained data and source failure are distinct. Cloud-cover percentage or calculated LCL cannot be labelled as a reported ceiling. A distant station is identified as regional context.
5. **Usable on the actual devices:** desktop and mobile layouts retain readable units and provenance, accessible controls and keyboard operation; sticky elements do not obscure content. Source changes, time changes, errors and empty coverage are verified with real integrations.

## Evidence and its limits

- A [self-described European helicopter pilot](https://www.reddit.com/r/aviation/comments/1i7l4rq/whats_your_best_weather_app/) specifically sought ceiling/rain forecasts and additional sources. This is a relevant firsthand use case, not a representative survey; the operation type was unspecified.
- A [European pilot discussion](https://www.reddit.com/r/flyingeurope/comments/1tcx8yk/what_are_you_using_for_quickly_checking_weather/) distinguishes a quick weather check from formal/company briefing. Regional station lists, history, meteograms, source switching and offline access appear in comments. Participants include airline and fixed-wing GA pilots; their preferences cannot be presented as helicopter consensus.
- [ČHMÚ briefing guidance](https://en.chmi.cz/web/chmi.cz/-/jak-udelat-predletovou-pripravu-) supports considering regional conditions, the route and the aerodrome, using observations, warnings and forecasts. Its [low-cloud product](https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti) and [SWL product](https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa) demonstrate useful regional information beyond point forecasts.
- [EASA helicopter operating-site guidance](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-air-operations?erules-id=ERULES-1963177438-12875) distinguishes point-specific weather and supplemental site information. The cited section concerns commercial IFR helicopter operations; its operational requirements must not become universal product rules.
- [CHIRP GA1395](https://chirp.co.uk/report/ga1395/) documents a reported discrepancy between a forecast overlay and observations, including an acknowledged feed error. It supports exposing evidence and uncertainty; it does not establish general unreliability of a product or justify an automatic “flyable” judgement.

There has been no representative survey of the intended local audience, agreed operational workflow, usability validation of this new product, or approval of a specific layout. Record owner acceptance only when supported by the conversation, with the date and scope. Routine engineering decisions within an authorised task can be made and documented with their reasons; they must not be relabelled as owner requirements.

Earlier numerical conventions are not requirements: no universal report-age threshold, legal weather minima or night/HEMS assessment has been accepted. A pressure-level wind is not a fixed height above a landing area, and lunar illumination is not a measurement of usable visual conditions.
