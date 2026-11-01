# What helicopter pilots need from a weather briefing

[Documentation index](../README.md) · [Interface references](interface-references.md)

Research consolidated on **1 November 2026**. This is a product research record for a helicopter briefing focused on South Bohemia and nearby Central Europe. It separates published evidence, first-person forum accounts and our design hypotheses. It does not establish operational minima or replace an operator's procedures.

## Evidence and its limits

The strongest structured source reviewed was Speirs, Ramée, Payan, Mavris and Feigh, *Impact of Adverse Weather on Commercial Helicopter Pilot Decision-Making and Standard Operating Procedures*, AIAA AVIATION 2021, DOI [10.2514/6.2021-2771](https://doi.org/10.2514/6.2021-2771). See the [primary paper](https://repository.gatech.edu/server/api/core/bitstreams/2db52f4d-0ae1-4ed4-8df7-6c4e9d93c1b3/content) and [PEGASAS project abstract, 2 August 2021](https://pegasas.aero/products/project-34-01/).

The 2020 US survey produced 216 complete responses, including **194 pilots**; approximately **70% had helicopter air ambulance experience**. Nine experienced pilots, three each from air ambulance, tour/air taxi and law enforcement, then completed Applied Cognitive Task Analysis interviews: an SOP/task overview, weather-event review and knowledge audit. **81% used at least three weather-source types before flight**; the average was **3.6 before flight versus 2.8 in flight**. Participants described sparse or inaccurate information away from airports and reliance on local experience. This was a self-selected, US, HAA-heavy sample, not a European population estimate or an interface experiment. It supports investigating information gaps and workflow differences; it does not prove a particular screen layout is safer.

Forum evidence below is narrower. Job roles and experience are self-described, contributions are not representative, and disagreements remain visible. Votes and emphatic language are not validation. A report of an app behaving incorrectly is a user's account, not an independently reproduced defect.

## What the discussions actually add

| Source and date | Concrete signal | Boundary or dissent |
| --- | --- | --- |
| [European helicopter pilot seeking weather apps](https://www.reddit.com/r/aviation/comments/1i7l4rq/whats_your_best_weather_app/), **22 January 2025** | The question specifically asks for ceiling and rain forecasts, already uses Windy, and seeks another perspective. | Replies also come from broader aviation. This is evidence of one helicopter pilot's problem, not proof that one recommended app is most accurate. |
| [Medevac IFR discussion](https://www.reddit.com/r/Helicopters/comments/1m9ud1b), **26 July 2025** | The operational context is medical transport with IFR capability. It is a reminder to investigate mission, aircraft capability and procedures before assuming a universal low-level VFR workflow. | An IFR medical transport discussion must not supply default limits for a single-engine private or utility flight. |
| [AWC redesign discussion](https://www.reddit.com/r/Helicopters/comments/17a18go), **17–18 October 2023** | A redesign generated resistance around accessing familiar weather information and changed interaction patterns. | It documents the 2023 transition, not the usability or feature set of AWC in 2026. |
| [HEMS-tool discussion](https://www.reddit.com/r/Helicopters/comments/17ca0w3), **20–22 October 2023** | Mixed-unit and workflow complaints make unit visibility and continuity useful research questions. | Participants disagreed about the tools and changes. Preserve that dissent rather than constructing a helicopter-wide preference. |
| [MAVIS discussion, page 1](https://www.pprune.org/rotorheads/671598-mavis-not-fit-purpose.html), **22–23 April 2026** | Onshore rotary contributors wanted cloud base, visibility/fog and precipitation together. Complaints concerned screen space, repeated navigation and losing the regional report list. | Other contributors found colours useful or forecasts reasonably good. One respondent explicitly identified as a fixed-wing PPL. An AMSL-versus-ground-height dispute was not evidence that AMSL itself is wrong. |
| [MAVIS discussion, page 2](https://www.pprune.org/rotorheads/671598-mavis-not-fit-purpose-2.html), **23 April–7 May 2026** | Accounts included slow time navigation, local fog not anticipated by forecasts, and using coordinates far from airports. On 29 April an offshore contributor reported crews using Helimet to obtain all METAR/TAF on one printed page. | Contributors distinguished forecast limitations from interface problems. A 28 April post reported useful changes to cloud-base gradations and datum: this was an evolving interface. Accuracy claims were anecdotal; Windy also received criticism. |
| [AS350 Portland–Anchorage ferry](https://www.pprune.org/rotorheads/665901-as350-portland-anchorage-ferry.html), **5–6 May 2025** | Route choice depended on weather, terrain, fuel, available stopping places and alternatives. Several respondents compared coastal and inland routes using personal experience. | This is a North American ferry context. Some replies explicitly came from nonpilots; route anecdotes are not instructions for Czech operations. |
| [European aviation weather workflow](https://www.reddit.com/r/flyingeurope/comments/1tcx8yk/what_are_you_using_for_quickly_checking_weather/), **2026** | A supplementary prompt for understanding quick checks and the mix of tools used in Europe. | Broader aviation, not helicopter consensus. The exact calendar day was not retained in this research record, so do not invent it. |

Together these sources favour **rich, connected evidence with little navigation overhead**, rather than an empty dashboard that conceals reports or graphs. They do not establish that every datum must occupy one phone viewport. The useful question is whether a pilot can keep the relevant relationships in view without repeatedly reconstructing location, time and source context.

## Product hypotheses to carry into the rebuild

These are our design interpretations to validate with local pilots, not quotations from the study.

1. **Begin with the operating area and time, not a departure airport alone.** Support a coordinate, heliport/base, region or route. Keep nearby station identity, distance and elevation visible. Distance helps orient the reader but does not establish that a station represents a valley, ridge or landing site. Regional METAR/TAF remain regional evidence.
2. **Let pilots compare evidence without losing their place.** Show important observation trends, forecast graphs, regional reports and local imagery together in a coherent reading order. A global model selector should update the forecast context consistently and name the selected model and run. Another model is a comparison, not independent confirmation if both displays use the same underlying data.
3. **Treat chronology as part of the data.** Keep observation time, forecast issue/run time, validity and retrieval time distinct. Distinguish recent observations, the selected future interval and longer outlook. Reports issued now do not become a forecast for an arbitrary selected date. A cached page or successful fetch must not make an expired report appear current.
4. **Expose local corroboration and contradiction.** Cameras, actual visibility, cloud observations and weather trends can challenge a forecast. Present conflicting evidence beside it; do not average the disagreement into one reassuring number. Identify a camera's location, orientation and image age. A photograph is an observation from one viewpoint, not a measured ceiling for an entire route.
5. **Use aviation quantities precisely.** Display wind in knots where selected, pressure in hPa, visibility in a clearly stated unit, and cloud/terrain heights with AGL or AMSL attached. Keep UTC report text intact; a local-time view must identify its zone. Do not silently turn low-cloud percentage into ceiling or a pressure-level wind into a fixed height above terrain.
6. **Keep the original report recoverable and readable.** Raw METAR/TAF should be available without losing decoded context. Explain known groups literally, leave unknown groups visible, and show cancellations, missing data and stale observations explicitly. An interpretation must not invent inherited TAF conditions or an overall permission to fly.
7. **Preserve continuity while monitoring a shift.** A refresh should retain the chosen area, interval and model. Visible changes and source ages matter more than decorative animation. Saved operating areas and a compact printable view are hypotheses worth testing; neither should become an excuse to hide the complete briefing.

## Missions must remain distinct

| Context to recruit and test | Questions the product must support |
| --- | --- |
| Day VFR local/private or training | What is changing locally, where is the nearest credible observation, and what does the planned interval contain? |
| Onshore HEMS, police or rescue | What evidence covers an uncertain destination or area, how quickly can the crew inspect it, and what are the information gaps? |
| IFR-capable medical/transport operation | How does the weather presentation fit actual aircraft capability, destination/alternate planning and operator procedures? |
| Utility, survey or other low-level work | Does the briefing describe the working area, terrain and changing wind/visibility rather than only an airport? |
| Ferry or cross-country | How do conditions evolve along route, where are gaps and alternatives, and which evidence supports each segment? |
| Night operation | Are illumination and the transition through dusk visible beside weather, with dates, time zones and definitions? |

These rows define interview coverage, not a claim that all pilots in a mission share identical requirements. Offshore-specific information, for example, should not be imported into an onshore Czech product merely because both users fly helicopters.

## Validation still required

Recruit pilots from the intended Czech operating contexts and observe an actual preflight brief and a later weather recheck. Ask them to compare a good-weather case, local fog, changing low cloud/rain, model disagreement and a missing or stale source. Measure whether they can identify the relevant area, time, units, source age and disagreement without coaching. Test desktop, tablet and phone separately. Preserve useful data while reducing repeated clicks; success is accurate interpretation and efficient access, not a lower card count.
