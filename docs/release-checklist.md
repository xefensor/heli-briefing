# Release checklist and support

Updated 2026-11-02. Applies to the South Bohemian **evaluation** on [GitHub Pages](https://xefensor.github.io/heli-briefing/). A completed engineering checklist is not intended-pilot acceptance or professional production access. Publication evidence is in [deployment](deployment.md).

**Current runtime:** [decision 0013](decisions/0013-direct-browser-integration.md) replaces the main site's snapshot path with compatible direct browser sources and retires deployment collection. GitHub Pages now publishes code/assets only. [Decision 0014](decisions/0014-browser-source-gap-recovery.md) subsequently restores SWL display and supplemental reports/history. The source-parity limits below remain unresolved.

## Completion boundary

| Area | Current delivered scope | Remaining dependency |
| --- | --- | --- |
| Core forecast | Eight directly visible plots, explicit model/comparison/place/time, exact values and qualified point profile. | Appropriate professional provider access and intended-pilot acceptance. |
| Reports | Direct Czech SWIM METAR/TAF, RAW/decoded evidence, nine retained station rows and conservative SIGMET/validity states. | LKHS remains absent; MET Norway international availability has a documented SWIM transition risk. Complete current FIR warning coverage is not established. |
| History | Genuine MET Norway archive plus browser observations, twelve-hour/400-report and 750 kB bounds. | Partial coverage and missing intervals remain visible; archive service continuity is not guaranteed. |
| Radar/satellite | Direct observed radar display/playback and directly fetched/embedded GeoColour image. | Radar pixels cannot be embedded offline without CORS permission; provider coverage/outages remain possible. |
| Cameras/charts/ceiling | Direct original SWL display, municipal camera viewer and alternate same-camera links; original embedded cameras, low-cloud and native ICON-D2 CEILING remain unsupported. | Original camera/low-cloud access; production integration and native-grid validation of the separately researched ICON-EU CEILING option. No proxy or substitute ceiling is used. |
| Route/light | Existing point/vertical weather, separately referenced Bpv terrain and local astronomy. | Native ceiling along the route remains unavailable; no obstacles, aircraft performance, operator minima or clearance assessment. |
| Output | Full frozen HTML/text, compact report pack, local archive and accurate source/export limitations. Older saved imagery remains readable. | Intended-device native save/print/PDF acceptance; video/radar/SWL links require network and cannot be mistaken for captured imagery. |
| UX | Existing rich workspace, direct navigation, responsive reports, persistent context/viewer and explicit partial coverage. | Pilot observation is still required to validate preparation usability. |
| Access/legal | No static secrets or project data service; source attribution and dated access evidence. | Owner licence decision, professional forecast access and source-specific redistribution agreements. |

The compatible-source browser migration is implemented. The **whole professional project remains incomplete** at the source, provider/licence and intended-pilot/native-output gates. No current-source statement implies a flight approval or uptime guarantee.

## Intended-pilot acceptance script

Use the pilot's actual desktop/tablet/phone. Record device/browser, time, task outcome, mistakes, source values and any required adjustment. Do not send operational notes to a public issue.

1. Select the base, another saved coordinate and a terrain-sensitive off-airport point. Identify location, main model, comparison, valid hour, timezone and source retrieval time without opening settings.
2. Compare wind/gusts, visibility, cloud information, precipitation and temperature across the same time axis. Inspect one source disagreement and one unsupported/missing field. Confirm the original station report remains recognizable.
3. Pin a future hour, refresh, wait for a normal monitoring tick and return to Teď. Confirm the future selection is retained during refresh and the planned route departure never moves with the live clock.
4. Open the municipal viewer and distinguish it from the original ČHMÚ sources. Identify its unverified normalized acquisition time, original SWL validity in its UTC image header, unsupported low-cloud/ceiling states and an actual radar frame time. Open official source links where needed; do not treat an unavailable product as clear weather.
5. Plan a simple route with explicit leg minutes. Inspect a route column, a below-terrain masked pressure level, the Bpv terrain datum and an outside-domain gap. Change model and verify the section changes without relabelling independent products.
6. Add a note and prepare a full briefing. Check exact context, coverage/source warnings, graphics, original bulletins, route and embedded satellite imagery. Radar/SWL/video remain labelled source links. Download, reopen with network disabled, then save PDF through the normal browser print dialog and inspect every page for clipping/missing content. Verify compact METAR/TAF output and copy/manual-copy behavior separately.
7. Reopen a saved briefing after changing the live workspace. Confirm the captured values/notes/time do not change. Check archive quota feedback, delete a disposable briefing copy, and verify saved-point/route undo separately.

These are prepared tasks, not completed pilot validation. Record results against this checklist before claiming acceptance.

## Source outages and incident handling

The **source timestamp** and status decide freshness. Compatible observation/satellite/radar checks run approximately every five minutes while visible/online; forecasts every ten minutes. A browser poll does not guarantee a newer product. There is no scheduled weather deployment. A restored local report remains unconfirmed until the provider refresh succeeds; its old observation/issue/retrieval dates remain unchanged. Known unsupported products are not retried as network failures.

During a failure, retain only real previous evidence with its original timestamps. A lost low-cloud slot does not select a different available image. A rate-limit response must not trigger automatic request bursts. The route section uses bounded requests and user-triggered initial loading. Never add fabricated weather, report text or a reassuring zero to make a view complete.

For a suspected processing issue, use the repository's [data-issue template](../.github/ISSUE_TEMPLATE/data-issue.yml). Include product/model, public point coordinates, valid time, observation/issue/run time, retrieval time, units/datum, expected source value and displayed value. Redact operational/private details and credentials. Check source payload against normalization, then rendering/output. A model forecast error is not automatically a parser defect.

For a critical mismatch, prefer a corrected deployment or a clear unavailable panel to silently retaining misleading data. Re-run relevant transformations and `npm test`, build and documentation checks. Verify the deployed commit and actual affected live source before closing. Git history supports reverting a release with a normal reviewed commit; do not force-reset the branch. No staffed support hours or uptime SLA have been agreed.

## Retention, privacy and maintenance

Saved points, route, preferences, notes and up to ten briefings / 20 MB live in the browser profile; they are not synced to an account. Briefings use IndexedDB with an atomic 20 MB serialized-data budget; existing localStorage snapshots are copied once without deleting the originals during migration. Explicit deletion removes the matching legacy copy as well as the database record. Browsers without IndexedDB keep the legacy 5 MB storage path. A quota-denied or too-large snapshot remains available in the open preview for HTML download. Downloaded files are managed by the person holding them. URLs share the selected point/model/time, not notes, route or captured weather; copied links pin the viewing time and load fresh data on opening.

The static site makes public provider requests and loads map tiles. It has no login, private backend or secret-bearing API requests. Forecast requests disclose the selected coordinates to the provider, including custom or device coordinates if the user chooses them. Do not put private provider keys into static files. A future private-credential service cannot be hidden in this static client. It requires a separately authorized access/architecture decision and must preserve the source/model/time contracts.

The deployment artifact excludes the entire weather data directory and generates no fallback weather. Historical collector source is retained for record/tests but is not executed by Pages. Current report retention is browser-local; downloaded exports do not receive later updates. The artifact also excludes repository configuration, tests and credentials.

Recheck source contracts/terms when introducing access changes, replacing a feed or entering professional use, and after an observed schema/source outage. Revalidate current DWD endpoint/migration handling before changing native ingestion. Review the three research tracks before substantial product changes; research does not replace target-pilot feedback.
