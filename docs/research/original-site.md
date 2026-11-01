# Original briefing content and workflow

[Documentation index](../README.md) · [Product brief](../product-brief.md)

Source: [pilot-authored Google Site](https://sites.google.com/view/krystof13-30). Checked on **2026-11-01** by retrieving the public page and inspecting its embedded HTML and JavaScript. The newly retrieved embed matched the earlier inspected source exactly. Embedded-source SHA-256: `3a52003d5b60d4cf87be63dc6e624ffca647b5e927204e472c45ea20f0c10ef2`.

Xef identifies this as the intended pilot's own page and directs us to use it as the content and workflow reference. The primary user is a South Bohemian professional helicopter pilot preparing reports for others. A shift overview is a working assumption. The source establishes available controls and implementation, not successful live operation or the pilot's exact reporting schedule.

## Observed content and controls

| Area | What the original actually contains | Baseline for the rebuild |
| --- | --- | --- |
| Location | LKCS/Planá default, LKHS/Hosín and device-GPS shortcuts. Location changes update labels, astronomy, weather queries and Windy links. | Preserve useful local shortcuts and a consistent selected-location context. |
| Date and clocks | Date picker, today action, UTC and local clocks. | Keep date and timezone context visible; coordinate it correctly with the data being displayed. |
| Solar information | Dawn, sunrise, sunset, dusk, solar noon, elevation/azimuth, day/night status, countdowns and a two-day solar/twilight profile. | Preserve substantial daylight and twilight information with accurate definitions. |
| Lunar information | Phase and illuminated fraction, horizon status, rise/set with adjacent-day handling, altitude/azimuth and a two-day profile with mouse/touch inspection. | Preserve useful lunar context and distinguish astronomical values from measured lighting conditions. |
| Current weather strip | Surface wind/direction, gust, a claimed ceiling/category, pressure/tendency, temperature/dew point/spread, visibility and a calculated QFE. | Preserve relevant quantities with honest source, time, units and calculation labels. |
| Four visible weather graphs | Cloud/base development, pressure, temperature/dew point, and surface/gust/upper wind; all labelled as 24-hour trends. | Retain the graph depth and relationships while correcting time axes and unsupported values. |
| Regional TAFs | LKPR, LKKB, LKPD, LKTB, LKKV and LOWL; raw, decoded or combined modes; refresh and source links. | Keep the regional report overview and original bulletin access. These stations are distinct from the selected LKCS/LKHS location. |
| External weather inspection | Windy forecast/model and radar/lightning links. SWL image with refresh, original-source link and an enlarged view. | Preserve access to regional context; an external link is not an integrated radar or camera layer. |
| Print intent | A footer button labelled “Tisk briefingu” calls `window.print()`. | Preserve and verify a readable browser-print output. |

The source contains no route editor, report composer, saved-report system, recipient management, bespoke PDF generator or camera integration. Adding these is new scope. There is no custom print stylesheet, and successful printing inside Google Sites was not tested.

## Actual sources

- Local forecast requests use Open-Meteo's `/v1/dwd-icon` with `models=icon_d2`, two requested calendar days and wind in knots.
- Regional TAFs attempt the AviationWeather.gov API. There is no METAR fetch in the inspected original.
- SWL is the image at `https://meteo.rlp.cz/swlmap.png`.
- Solar calculations run locally; moon calculations normally use SunCalc 1.9.0. Windy is opened through external links.

These observations describe the original code, not the recommended final provider stack. See the [data catalogue](../data/sources.md).

## Defects to correct rather than preserve

1. **Model and profile controls are misleading.** ECMWF changes a label and Windy destination while the local request stays ICON-D2. The profile control changes an otherwise unused variable and reloads.
2. **Date and weather context diverge.** The date picker recalculates astronomy only. Weather graphs take the first 25 hourly array entries without reading their timestamps, despite labels implying a rolling now-to-24-hour forecast.
3. **Several quantities are approximated or fabricated.** The claimed ceiling comes from temperature/dew-point spread; a pressure-level wind is labelled as a fixed AGL height; missing upper wind can be synthesised from surface wind. QFE uses a fixed pressure offset. These must be replaced by correctly defined data or visibly unavailable fields.
4. **Missing reports can look official.** Failed or absent TAFs are replaced with fabricated strings containing current issue dates. Decoding also supplies default conditions. Retain real reports and honest gaps; do not carry these fallbacks into the rebuild.
5. **Astronomy has invalid fallback states.** Missing moonrise/set can become fixed invented times, and some displays mix the chosen date with actual now. Calculate and label the selected instant and genuine missing/no-event states.
6. **Refresh is not source freshness.** The SWL update label records a refresh attempt. A TAF age-updating function is defined but not invoked. Use actual issue/observation times and successful-load state.

The original's displayed VFR/category conventions and night labels do not establish applicable legal or operator minima. Their definitions need independent verification.

## Workflow inference

The section order suggests a preparation worksheet: select base/date, inspect daylight and lunar context, assess weather trends and regional reports, inspect SWL, and print when useful. The user confirms that the pilot prepares reports for others. The source does not show how the final report is composed, delivered or scheduled.

Use this evidence to establish a complete web briefing and verified print output before inventing a report-management workflow. Preserve the useful depth while making source switching, time selection and data reliability work consistently. The final visual arrangement remains a design decision.
