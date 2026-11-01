# Data integrity and interpretation

[Documentation index](../README.md) · [Source catalog](sources.md)

Last reviewed: **2026-11-01**. These are requirements and proposed design rules for a future briefing system. They are not a claim that an existing application satisfies them. Provider facts and verification samples are recorded in the [source catalog](sources.md).

## 1. Preserve meaning before simplifying presentation

Every displayed value needs enough provenance to answer: what was measured or forecast, where, at what height/reference, by which source/model, and for what time? Separate observations, model forecasts, warnings, imagery and calculations. An airport observation near a landing location remains that airport's observation; distance and station identity matter.

Do not synthesize missing weather, raw reports or flight categories. A real zero is valid data; missing, malformed, unsupported and outside-coverage values are different states. Nulls must remain gaps in charts and exports. Do not substitute zero, join a line across an unreported interval, or carry a value forward without explicitly describing that operation.

A generic model label is insufficient when fields come from different models or domains. A capability matrix should distinguish model, field, height, source derivation and valid-time coverage. A successful request and a nonempty time array do not prove that every field is available.

## 2. Keep source and retrieval times separate

Preserve these independently where provided:

1. Observation or image-acquisition time.
2. Model initialization time, for a forecast model run.
3. Publication/issue time.
4. Forecast valid instant or interval.
5. Local retrieval time.

Retrieval must never replace a missing issue time or make an old product appear fresh. HTTP headers and file modification times describe transport/storage unless the provider explicitly defines otherwise. Open-Meteo's `generationtime_ms` is a duration, not a timestamp, and its ordinary response does not establish a particular run.

Use UTC instants internally with explicit units: Unix seconds and JavaScript milliseconds must not be interchanged. Display either UTC or the chosen location's timezone with date and zone. For Czech local time, use `Europe/Prague`, including daylight-saving transitions. Reject nonexistent spring-transition input; make an ambiguous autumn input explicit rather than silently selecting a different instant.

Future observation timestamps beyond an allowed clock tolerance require an attention state. Clamping a negative age to “0 minutes” hides the problem. A cached response can contain an expired forecast; transport freshness and product validity are separate dimensions.

## 3. Respect valid intervals and field semantics

Hourly precipitation totals and maximum gusts commonly describe the preceding interval, not an instantaneous reading at its endpoint. For the sampled Open-Meteo fields, label these as the preceding hour ending at the supplied timestamp. An interval `(t − 3600, t]` overlaps a selected window when `t > start` and `t − 3600 < end`.

Consequently, a summary may need an endpoint after the selected window to include an overlapping accumulation interval. That does not authorize treating that endpoint's instantaneous temperature, wind or pressure as inside the window. Label partial overlaps and keep their semantics in downloaded snapshots. Do not shift rainfall or gust peaks one hour earlier through a shared “instantaneous” table.

Calculate coverage from actual valid timestamps and non-null fields. A requested three-day array is not a guaranteed three-day usable forecast. Model-specific horizons, run delays and missing tails must be visible. Avoid interpolating across a genuinely missing report merely to keep a graph continuous.

## 4. Cloud, visibility, wind and pressure are not interchangeable

- Cloud-cover percentage is not cloud-base height or aviation ceiling. Low-cloud cover alone does not justify a flight category.
- Convective cloud base is not total ceiling. Raw DWD `CEILING` has a documented non-convective, greater-than-50% cloud diagnostic definition and an MSL reference. Retain that qualification and use matching model terrain for an AGL conversion.
- A 925 hPa surface is a pressure level whose height changes. Label its wind with the pressure level and geopotential height MSL; never relabel it as a fixed 2,100 ft AGL wind. Check for below-terrain levels and missing height data.
- Returned ICON-D2 925 hPa values are not verified native D2 fields. The field-specific derivation remains a question for provider/code verification.
- Model visibility is not a local measurement. Raw fog/cloud and precipitation visibility diagnostics may have different definitions or interval minima; do not erase that distinction in a combined variable.
- Sea-level pressure, model surface pressure, QNH and QFE are different quantities. A calculated pressure estimate needs its inputs, assumptions and label; it must not become an official measured setting through presentation.

## 5. Aviation reports: preserve raw text and exceptional states

Keep the raw METAR/TAF alongside any decoded summary. Preserve station, observation/issue time, validity and correction/amendment state. Normalizers must tolerate provider nulls, reject invalid timestamps and units, and avoid treating absent gusts or temperatures as zero.

AWC visibility can be expressed in statute miles, including fractions and lower-bound forms. International `9999` and `CAVOK` represent a lower bound, not a precise unlimited visibility measurement. Retain a lower-bound flag after conversion. Variable wind is distinct from a missing direction.

TAF `CNL` is cancellation and `NIL` means the report is unavailable; neither is forecast coverage. A timestamp-bounded NIL message must not count as a complete forecast. Expired, superseded or future products need their own handling. Preserve `TEMPO`, probability and change-period semantics instead of reducing all periods to one misleading deterministic value.

SWIM's “latest” files and XML/text variants can disagree or be old. Determine status from report content and internal times. A missing station in one AWC response is not proof that it never reports. Never create a plausible-looking fallback TAF or copy a nearby station's forecast under the selected location's identity.

## 6. Images and context layers need timestamps and boundaries

Radar can have masked, blocked or unobserved areas. No returned pixels or an empty tile does not mean no precipitation. Keep product type, acquisition/valid time, legend and coverage visible. Distinguish observed composites from extrapolations; do not advertise a viewer's horizon as an available open-data product.

For OPERA accumulations, the documented discovery interval identifies the start while the filename timestamp identifies the end. Preserve both before aligning a radar accumulation with model precipitation. Neither an accumulation nor a maximum-reflectivity composite is an instantaneous surface rain-rate measurement.

Satellite infrared, visible and RGB imagery convey different phenomena. Cloud-top imagery does not measure cloud base. Nighttime limits on visible imagery are not clear weather. A webcam can be stale despite a successful image request; retain camera time, location and attribution, and avoid claiming visibility beyond what the camera can show.

Terrain models do not establish obstacle clearance. Include vertical datum and resolution when comparing terrain with model heights. A planning airspace allocation is not confirmed current activation. Astronomy calculations must use the selected location and instant; lunar phase/fraction is not actual surface illumination.

## 7. Access, caching and failure handling

These are proposed adapter rules, not provider guarantees:

- Use fixed upstream endpoints and bounded station/model parameters; do not build an arbitrary-URL proxy.
- Keep provider keys server-side. Use a backend for AWC's documented CORS limitation. A provider's permitted browser API can be called directly where appropriate, subject to its terms.
- Respect 429 responses, retry guidance and provider limits. Do not rotate egress or alternate endpoints to bypass a quota.
- Cache completed, bounded data with original timestamps. Avoid sharing pending I/O across unrelated serverless request lifetimes.
- Distinguish live, cached, stale and unavailable transport states, while separately evaluating report age, forecast expiry and field coverage. A stale fallback should remain visibly stale and carry the current source failure.
- Set timeouts, reject unexpected formats and record concise diagnostics without secrets or precise private locations. Do not mask a provider failure behind invented data.

Public access, open-data licensing and permission to redistribute are separate checks. Preserve attribution in imagery, exports and derived products. SWIM redistribution, direct-camera reuse and operational aeronautical information require source-specific evidence; do not inherit rights from an adjacent service.

## 8. Verification that supports a claim

Keep unit tests for normalization and temporal edge cases separate from live connectivity checks. Useful fixtures cover null versus zero, lower-bound visibility, malformed timestamps, expired/CNL/NIL TAFs, partial forecast coverage, preceding-hour accumulations, timezone folds/gaps and stale fallback after failures.

A live sample records endpoint, requested fields/model, public test location, retrieval time and returned coverage. It proves that response only. It does not establish forecast skill, an SLA, universal geographic coverage, browser compatibility, or successful deployment. Before asserting an integration works, verify its intended runtime, actual source payload and rendered empty/error states.
