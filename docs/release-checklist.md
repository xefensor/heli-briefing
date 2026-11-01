# Release checklist and support

Updated 2026-11-01. Applies to the South Bohemian **evaluation** on [GitHub Pages](https://xefensor.github.io/heli-briefing/). A completed engineering checklist is not intended-pilot acceptance or professional production access. Publication evidence is in [deployment](deployment.md).

## Completion boundary

| Area | Delivered scope / evidence | Remaining dependency |
| --- | --- | --- |
| Core forecast | Eight aligned graphs, explicit three-model selection/comparison, common place/time/horizon, exact values and six-level point profile. Unsupported fields stay empty. | Professional hosted-service access appropriate to the actual organization/use. No local forecast-skill ranking is claimed. |
| Observation context | Original METAR/TAF/SIGMET, conservative summaries, requested/missing stations, twelve-hour METAR history, observed radar loop and GeoColour satellite. | Provider uptime/coverage; the collector cannot create a report a station has not supplied. |
| Local imagery | Three verified ČHMÚ-owned cameras, frame age/orientation/location, enlargement, SWL and low-cloud charts with their own validity/legend, low-cloud map overlay. | Public website APIs have no contracted uptime or version guarantee. Other camera owners require separate rights. |
| Route | Up to six points, explicit departure and leg minutes, point-model comparison, discrete route graphs, up to 17 vertical forecast columns and 257 independently referenced Bpv terrain samples. | No aircraft performance, obstacle/wire database, safe-altitude calculation or authorized navigation planning is included. |
| Astronomy | Calculated selected-instant sun/moon positions, genuine absent events, daylight/twilight and two-day altitude graph. | Terrain horizon and measured ground illumination are not available. No operator/night minima are inferred. |
| Preparation/output | Notes, captured-source review, full standalone HTML with images/data, compact original-report pack, plain text/manual-copy fallback and bounded local archive. | Target-browser native save/print acceptance, with the actual intended pilot. Cloud-browser file delivery is recorded separately. |
| UX | Stable global context, readable aligned data, direct section links, responsive editing, keyboard chart inspection, image dialogs and refresh that preserves inspection context. | Real pilot observation is needed to validate usability; browser layout checks cannot supply it. |
| Access/legal | Source attribution, explicit stale/missing states, no static credentials, scoped generated artifacts and guarded GitHub publication. | Owner selects code/docs licence. No blanket licence for third-party data is implied. |
| Aeronautical data | Direct official AIM link. The application does not claim live NOTAM, obstacles or airspace activation. | Written redistribution permission / authorized operational interface before an integrated feed. |

All buildable features in this evaluation scope are implemented. The **whole professional project remains incomplete** until the relevant external access, licence and pilot/output acceptance gates are resolved. Accounts, automated distribution, alerts, aircraft minima and additional commercial services are not silently added to scope.

## Intended-pilot acceptance script

Use the pilot's actual desktop/tablet/phone. Record device/browser, time, task outcome, mistakes, source values and any required adjustment. Do not send operational notes to a public issue.

1. Select the base, another saved coordinate and a terrain-sensitive off-airport point. Identify location, main model, comparison, valid hour, timezone and source retrieval time without opening settings.
2. Compare wind/gusts, visibility, cloud information, precipitation and temperature across the same time axis. Inspect one source disagreement and one unsupported/missing field. Confirm the original station report remains recognizable.
3. Pin a future hour, refresh, wait for a normal monitoring tick and return to Teď. Confirm the future selection is retained during refresh and the planned route departure never moves with the live clock.
4. Inspect a camera's location/direction/time, an SWL map outside its validity, a missing low-cloud slot and one radar acquisition time. Identify forecast versus observation without changing the main model.
5. Plan a simple route with explicit leg minutes. Inspect a route column, a below-terrain masked pressure level, the Bpv terrain datum and an outside-domain gap. Change model and verify the section changes without relabelling independent products.
6. Add a note and prepare a full briefing. Check exact context, source warnings, graphics, original bulletins, route and embedded imagery. Download, reopen with network disabled, then save PDF through the normal browser print dialog and inspect every page for clipping/missing content. Verify compact METAR/TAF output and copy/manual-copy behavior separately.
7. Reopen a saved briefing after changing the live workspace. Confirm the captured values/notes/time do not change. Check archive quota feedback, delete a disposable briefing copy, and verify saved-point/route undo separately.

These are prepared tasks, not completed pilot validation. Record results against this checklist before claiming acceptance.

## Source outages and incident handling

The **source timestamp** and status decide freshness. Browser checks every five minutes do not mean a deployment collector runs every five minutes. Scheduled Pages collection is nominally every twenty minutes and may be delayed by GitHub. Forecast monitoring is ten minutes. The UI surfaces original frame/report ages and explicit stale/unavailable states. Cameras older than thirty minutes are marked old; this is a display-age rule, not an aviation limit.

During a failure, retain only real previous evidence with its original timestamps. A lost low-cloud slot does not select a different available image. A rate-limit response must not trigger automatic request bursts. The route section uses bounded requests and user-triggered initial loading. Never add fabricated weather, report text or a reassuring zero to make a view complete.

For a suspected processing issue, use the repository's [data-issue template](../.github/ISSUE_TEMPLATE/data-issue.yml). Include product/model, public point coordinates, valid time, observation/issue/run time, retrieval time, units/datum, expected source value and displayed value. Redact operational/private details and credentials. Check source payload against normalization, then rendering/output. A model forecast error is not automatically a parser defect.

For a critical mismatch, prefer a corrected deployment or a clear unavailable panel to silently retaining misleading data. Re-run relevant transformations and `npm test`, build and documentation checks. Verify the deployed commit and actual affected live source before closing. Git history supports reverting a release with a normal reviewed commit; do not force-reset the branch. No staffed support hours or uptime SLA have been agreed.

## Retention, privacy and maintenance

Saved points, route, preferences, notes and up to ten briefings / 20 MB live in the browser profile; they are not synced to an account. Briefings use IndexedDB with an atomic 20 MB serialized-data budget; existing localStorage snapshots are copied once without deleting the originals during migration. Explicit deletion removes the matching legacy copy as well as the database record. Browsers without IndexedDB keep the legacy 5 MB storage path. A quota-denied or too-large snapshot remains available in the open preview for HTML download. Downloaded files are managed by the person holding them. URLs share the selected point/model/time, not notes, route or captured weather; copied links pin the viewing time and load fresh data on opening.

The static site makes public provider requests and loads map tiles. It has no login, private backend or secret-bearing API requests. Forecast requests disclose the selected coordinates to the provider, including custom or device coordinates if the user chooses them. Do not put private provider keys into static files. A professional adapter must keep credentials server-side and preserve the existing explicit source/model/time contracts.

Deployment-generated report/imagery snapshots are not committed. Cached camera/chart fallback retains genuine images and original times; mutable collector cache retention is controlled by GitHub Actions. Local data exports do not receive later updates. The generated artifact excludes repository configuration, tests and credentials.

Recheck source contracts/terms when introducing access changes, replacing a feed or entering professional use, and after an observed schema/source outage. Revalidate current DWD endpoint/migration handling before changing native ingestion. Review the three research tracks before substantial product changes; research does not replace target-pilot feedback.
