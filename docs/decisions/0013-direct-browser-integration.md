# 0013 · Direct browser integration in the main workspace

Date: 2026-11-02. Status: implemented and published; current deployment and live evidence recorded in [deployment](../deployment.md).

**Subsequent recovery:** [decision 0014](0014-browser-source-gap-recovery.md) restores SWL display and supplemental reports/history. The source limitations below describe this initial migration checkpoint.

## Owner instruction and study review

The owner authorized replacing everything feasible in the main GitHub website after the [browser-source prototype](../browser-only-feasibility-2026-11-02.md). The ordinary-browser/no-extension/no-project-backend constraint remains in force. This is an implementation decision under that authorization; remaining source limits are not claimed as accepted operational capability.

| Evidence | Consequence |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Keep real observations beside forecasts, original report text and rich plots. Missing stations, source gaps and video age stay explicit. |
| [Interface references](../research/interface-references.md) | Retain shared context and eight directly visible graphs. Do not reset the municipal viewer on clock/data/model changes. Keep provider links one action away. |
| [Data sources](../data/sources.md) | Use the verified direct routes, preserve source dates and coverage, and distinguish ordinary image display from permission to capture bytes. |

## Implemented behavior

- Main reports now use direct allowlisted ČHMÚ SWIM TAC files, maximum two concurrent requests. All nine station rows stay visible. Missing foreign/LKHS reports link to additional official source views. Original cancellation/expiry and unknown dates remain explicit.
- Fresh transport does not imply full coverage. `coverageComplete:false` keeps SIGMET uncertain, and out-of-selection/expired reports remain inspectable. Partial METAR/TAF coverage is stated beside the station matrix.
- A new browser-local cache retains up to 400 actual observations over twelve hours, within a 750 kB serialized budget. It strips images/radar, validates SWIM provenance and preserves previous storage on failure. Reopening marks reports unconfirmed until direct refresh; no complete historical archive is invented.
- Satellite capabilities/GetMap run directly in the browser. A newer retained real image is preserved if a refresh can only fetch an older fallback. Observation and download times remain separate.
- Radar confirms four recent UTC image candidates for a light initial view. Playback loads up to 24 real frames on request, with two simultaneous image loads. Gaps remain gaps and selected historical frames survive refresh where still present. CORS prevents pixel capture, so frozen output retains time/source/link rather than fake embedded bytes.
- Original ČHMÚ camera/chart identities remain compact explicit unavailable states and official links. The separate official municipal Radnice viewer opens on request, remains mounted through refresh/model changes and closes explicitly. It has no normalized acquisition time and is never captured as a frozen image.
- The native ICON-D2 CEILING panel remains explicitly unavailable with its original source link. It has no data request or fake loading state. Point/route forecasts, qualified pressure profiles, terrain and astronomy continue directly in the browser; no cloud fraction/convective-base substitute is used.
- Full/compact output preserves actual provider identity, report coverage, restored-item warnings, partial history and online-only sources. Legacy saved reports/images remain readable. The browser archive is not a server backup.
- Pages now tests and builds code/assets only. The build excludes all `web/data`, including stale local/collected files, and produces no fallback weather JSON. Cron, collectors, decoder installation and weather caches were removed from the deployment workflow. Historical collector code remains for record/tests.

## Validation and limits

Local browser checks loaded all eight plots, nine report entries, fresh LKCS observations, direct satellite and radar. The municipal viewer played at 2592×1944 and remained mounted across model/comparison changes and manual refresh. Its responsive frame was sized to contain the complete provider player; the final published version was verified playing after that adjustment. Keyboard selection retained a pinned future hour. Reload visibly restored unconfirmed report cache before live refresh. Phone content/scroll width matched at 375 px inside the 390 px responsive frame and 305 px inside the 320 px frame; frozen output kept the satellite image and source restrictions without remote video/iframe requests. The phone preview measured 349 px with no dialog overflow. Clipboard access was denied in the embedded phone check; the manual fallback exposed and selected 3,834 characters. Actual local history grew from one to two real LKCS observations.

Final deterministic/build/document and public-HTTPS results are in [deployment](../deployment.md). These checks do not establish intended-pilot acceptance, universal device playback, native PDF/file-save delivery or professional provider access. Original cameras, integrated SWL/low-cloud/native-ceiling and complete foreign-report/warning/history parity remain source dependencies. The whole professional project is not complete.
