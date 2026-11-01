# Aviation interface references

[Documentation index](../README.md) · [Pilot needs and evidence](pilot-needs.md)

Reference review consolidated on **1 November 2026**. These are documented interface patterns and public illustrations, not account-based usability tests. No authenticated service workflow was tested. Source dates and illustration dates differ; an old image is identified as historical. Third-party assets are linked, not copied into this repository.

## HemsWX: local evidence around a regional map

**Documented:** Norsk Luftambulanse's [system overview](https://hemswx.info/doku.php?id=grunnleggende:hva_er_systemet), last edited **28 May 2026**, describes a decision-support system for emergency helicopter crews. It combines dedicated weather-camera stations, other cameras, aviation reports and route forecasts. Route forecasts show vertical sections of wind, temperature, humidity and cloud density up to 15,000 ft. The published camera guidance explicitly distinguishes external cameras whose quality and updating the service does not control.

**Illustrations reviewed:** [selected-station interface](https://hemswx.info/_media/grunnleggende:img_2734.jpeg) and [route forecast illustration](https://hemswx.info/_media/grunnleggende:skjermbilde_2026-03-30_kl._10.12.58.png). The latter filename contains **30 March 2026**; the station image has no reliable capture date. See also the [basic usage documentation](https://hemswx.info/doku.php?id=grunnleggende:hvordan).

**Design judgment:** the strongest helicopter-specific reference is the connection between regional position, nearby visual evidence and vertical route context. For our product, keep location and evidence age attached as the reader moves between them. The tradeoff is marker/layer density and uneven observation coverage. This is a pattern reference, not evidence that Norwegian data, access arrangements or mission procedures transfer to the Czech Republic.

## DWD FlugWetter: complementary views of the same flight

**Documented:** the [official app manual](https://www.dwd.de/DE/leistungen/lf_03_flugwetter_app/flugwetter_app_bedienungsanleitung.pdf?__blob=publicationFile&v=2), [cross-section guide, March 2025](https://www.dwd.de/EN/ourservices/aviation_lf_03_app/cross_sections.pdf?__blob=publicationFile&v=1) and [meteogram legend](https://www.dwd.de/DE/leistungen/lf_03_flugwetter_app/meteogramme_legende.pdf?__blob=publicationFile&v=2) provide illustrated aviation map, route and time-series references. The legends make the represented weather quantities and vertical/time axes inspectable. These are public manuals, not a live paid-account trial.

**Design judgment:** a map answers where, a meteogram when, and a route section what the vertical relationship looks like along the flight. Keep those views coordinated instead of asking a single chart to do all three jobs. The tradeoff is technical density and dependence on legends; the first view should use the pilot's selected region and interval while keeping full detail available. The source PDFs are the illustration references; no manual figures are reproduced here.

## AWC GFA: a broad spatial scan with a shared clock

**Documented/visible:** the [official GFA tutorial](https://aviationweather.gov/gfa/help/?page=tutorial) explains the weather-map workflow. Its [overview illustration](https://aviationweather.gov/assets/overview_blank-CPbrJ1-U.png), inspected during research, is dated **14 February 2025** in the displayed product. It shows a large map, weather-product controls, a time control and contextual map information.

**Design judgment:** preserve geographic continuity while changing a layer or time. Explicit legends and product names are more useful than unexplained coloured dots. The tradeoff is the effort required to discover products and understand overlapping symbols. The 2023 redesign complaints in [pilot-needs.md](pilot-needs.md) are historical user evidence; they are not a current usability test of this 2025 illustration or the 2026 service.

## Windy: compare models in a consistent place

**Documented:** [the current location-forecast update article](https://www.windy.com/-explore-the-location-forecasts-biggest-update/articles/43908), reviewed in **2026**, is the current product reference. The [Compare-feature guide](https://community.windy.com/topic/9427/how-to-use-the-compare-feature) is **historical, 2019**; it illustrates the longstanding idea of comparing forecast models for one location on a common time axis. Do not present that old layout as a capture of today's product.

**Design judgment:** model comparison should preserve place, period, units and parameter ordering. In a briefing, change the model consistently across associated forecast views and expose its run time. The tradeoff is false confidence: multiple model rows do not form a probability forecast, and identical provider branding does not make feeds independent. Observed conditions should remain visually distinct from forecasts.

## MAVIS: region-to-station navigation and an observation/forecast matrix

**Documented:** the Met Office's illustrated [navigation guide](https://docs.mavis.metoffice.gov.uk/guidance/navigating-mavis/) shows sites, weather layers and reports in a drawer, station selection for reports, and a map-key control. Exact reviewed illustrations are the [navigation overview](https://docs.mavis.metoffice.gov.uk/img/navigating/navigation-overview.avif) and [report navigation](https://docs.mavis.metoffice.gov.uk/img/navigating/report-navigation.avif); no capture dates are stated. The [36-hour table guide](https://docs.mavis.metoffice.gov.uk/guidance/aerodrome-threshold-table/) shows historical observations followed by forecasts, parameter rows and threshold explanations; see its [matrix illustration](https://docs.mavis.metoffice.gov.uk/img/36h-aerodrome/observations.avif).

The official [FAQ](https://www.metoffice.gov.uk/services/transport/aviation/regulated/mavis/faqs) confirms **HeliBrief stopped functioning on 24 March 2026**. These are MAVIS guide illustrations, not legacy HeliBrief screenshots. Access-dependent or planned features should retain those qualifications.

**Design judgment:** a station/time matrix makes deterioration easier to inspect; map selection retains regional context. The tradeoff is airport orientation and dense threshold coding. Preserve a readable regional report list alongside detail, and state the height datum. Forum dissatisfaction cannot by itself establish a product defect or forecasting error.

## ForeFlight: summary to detail, with route context

**Documented:** [Weather in Profile View](https://www.foreflight.com/enhancements/weather-in-profile-view), **July 2020**, connects weather to a route's vertical profile. [Daily/Hourly Forecasts](https://foreflight.com/enhancements/daily-hourly-forecasts), **December 2020**, demonstrates progression from daily outlook to hourly detail. The [reviewed hourly illustration](https://cdn.prod.website-files.com/65a814952b608914056fb769/67f845ecd05efe7f2adbb31f_67cbf6c2a38cbd1a3a5b4433_img_2665.avif) belongs to that historical reference; a CDN migration does not establish a new screenshot date.

**Design judgment:** use progressive detail while retaining the selected period and route. The tradeoff is that a polished summary can conceal the evidence a pilot needs. This is a general aviation interface reference, not proof of helicopter-specific suitability or a 2026 feature audit.

## GRAMET and Meteoblue AIR: meaningful graph density

**GRAMET documented:** the [autorouter interpretation guide](https://www.autorouter.aero/wiki/gramet/) describes a route section with distance/time, vertical weather structure, terrain, wind and the forecast reference time. Its [complete illustration](https://www.autorouter.aero/wiki/wp-content/uploads/2014/04/gramet_complete1.jpg) is a **2014 example**. The old guide's assertions about which models are openly available must not become claims about the 2026 data market.

**Meteoblue documented:** [Meteogram AIR help](https://content.meteoblue.com/en/private-customers/website-help/aviation/air) explains the multi-panel aviation meteogram. The reviewed [Basel illustration](https://content.meteoblue.com/assets/images/graphics/meteogram-AIR_basel_2024-03-20.png) is dated **20 March 2024**, not a current forecast.

**Design judgment:** both references demonstrate how aligned weather panels reveal relationships that isolated metric cards lose. A shared time cursor and legible axes can keep rich graphs usable. Their tradeoff is learning effort and model-dependent apparent precision. A local meteogram and a route section answer different questions; do not make them interchangeable. Keep the selected model, run, terrain datum and units explicit.

## Other useful checks

The [SkyDemon manual](https://skydemon.aero/help?handler=Manual), **pages 40–43 in the reviewed edition**, supplies map/profile and raw-or-decoded report-pane references. The linked manual is mutable, so future readers should recheck pagination. Garmin's [16 June 2026 announcement](https://www.garmin.com/en-US/newsroom/press-release/aviation/garmin-adds-daily-weather-and-other-features-to-garmin-pilot-app/) is a dated first-party feature reference, not an independent evaluation. These can inform discoverability and report presentation without copying their whole EFB workflows into a regional briefing.

## Direction for our interface

Our proposed combination is a persistent area/route, model and time context; readable graphs with aligned axes; visible regional reports; and local observations/cameras beside forecast evidence. Use detail controls to explain data, not to conceal the core briefing. Keep evidence age and missing coverage visible. Avoid converting model agreement or a coloured category into an overall safe-to-fly judgment. This combination is our design proposal for validation with intended pilots, not an existing product's documented workflow or a result proven by these reference images.
