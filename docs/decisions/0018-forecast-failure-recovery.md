# 0018 · Bounded forecast failure recovery

Date: 2026-11-02

Status: implemented for v0.8.1. Actual deterministic, browser and publication evidence is recorded in [deployment](../deployment.md); provider availability and whole-project acceptance remain separate.

## Problem and current-source check

The owner reported an ALADIN HTTP 503 and inconsistent model loading. The three main forecast models all use the same public Open-Meteo `/v1/forecast` service, with explicit model identifiers. They are different models, not three independent transport providers.

At approximately 14:26 UTC, the exact application queries for public LKCS coordinates returned HTTP 200 for all three models. ALADIN supplied 72 usable hours, ICON-D2 supplied 61 with eleven null trailing hours, and ECMWF supplied 72 for its supported surface fields. These requests did not include browser Origin, so absent CORS response headers establish nothing about browser access. No query/model-identifier defect or provider-wide outage was established. The reported 503 was not reproduced during those checks; a transient upstream failure remains an inference.

Later actual local-browser checks received HTTP 429. The new page showed the quota state, held the retry action until its deadline, and one permitted later attempt received another 429. The test page was then closed; no alternate endpoint, egress or quota workaround was attempted. This is evidence of a current limitation in the test browser, not proof that every user or every request was blocked.

Primary documentation checked: [CHMI](https://open-meteo.com/en/docs/chmi-api), [DWD](https://open-meteo.com/en/docs/dwd-api), [ECMWF](https://open-meteo.com/en/docs/ecmwf-api) and [model updates](https://open-meteo.com/en/docs/model-updates). The [official status page](https://status.open-meteo.com/) exposed only a dynamic shell; it did not provide a reliable live-health result in this investigation. Dedicated DWD/ECMWF routes share the same host and were not established as independent failover services.

## Three-study review

| Study | Applied repair |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Keep useful same-context evidence visible, reduce repeated setup, and let a failed point forecast retry without waiting for unrelated imagery/model workers. |
| [Interface references](../research/interface-references.md) | Publish main and comparison outcomes independently. A slow or failed comparison must not keep a successful main model blank. Show failure/progress beside the affected source. |
| [Data sources](../data/sources.md) and [integrity](../data/integrity.md) | Retry only the same explicit query/model, respect provider limits, preserve nulls and original retrieval clocks, and never substitute another model under the requested label. |

## Decision

The shared forecast client makes at most **two attempts total**, with one **one-second** retry for HTTP 502/503/504 or a fast network failure. The existing **18-second total deadline** includes both attempts, response processing and retry delay; it does not restart for the second attempt. Format errors, no usable values, HTTP 400/429 and other non-selected statuses are not automatically repeated.

A future `Retry-After` prevents the immediate retry. HTTP 429 installs a provider-wide pause within this shared client, covering models, points and forced refreshes; its deadline is at least sixty seconds when the header is absent or shorter. Other terminal transient failures pause that model for sixty seconds, or the advertised later deadline. Waiting retries recheck newly reported pauses before another HTTP request. An older concurrent 429 still applies even when a newer same-key request succeeded; an older 503 cannot replace newer successful same-key cache state. A concurrent success cannot clear another point’s newer same-model pause. Caller cancellation never creates a stale result or failure pause.

These pauses are browser-client state, not a service-wide limiter or a claim of coordination between separate browser tabs/origins. Existing request ownership and bounded route/section concurrency remain; in-flight requests are not merged into a new cross-caller queue.

Only usable successful payloads enter the forecast cache. An all-null 200 cannot overwrite genuine same-point/model weather; legacy empty cached entries are ignored. Failed renewals may retain only actual same-context data within the existing six-hour limit, with their original retrieval date and explicit stale/error state. Different coordinates/models and future-dated cache entries are not retained as the current result.

The main and comparison requests start together but render as each settles. Output remains gated while either selected request is pending. A failed comparison contributes to monitor failure/cooldown instead of being counted as a healthy refresh. Superseded/cancelled monitor work does not invent a success timestamp or shorten an existing failure deadline. A restored page with a missing main/comparison result requests that context again, still subject to client cooldowns; native bfcache restoration was not separately exercised.

The forecast panel has a direct retry action; comparison has its own retry action. Both respect the client cooldown. These actions bypass waiting on unrelated monitor work, while the global refresh continues to cover the complete workspace. Error text has one sentence boundary, retains source uncertainty, and does not recommend model switching as a way around a shared quota. The selected model is never changed automatically.

## Verification boundary

Deterministic tests cover same-query recovery, retry limits/deadlines, shared pauses and concurrent races, cancellation, legacy/all-null cache handling, original clocks and independently settling models. Actual provider success, controlled failure tests, browser quota observations, publication and intended-pilot acceptance remain distinct kinds of evidence. See [deployment](../deployment.md) for final counts/build/source identity.

The **whole professional project remains incomplete** at the [source, access, pilot and native-output gates](../release-checklist.md). This repair improves failure handling; it cannot guarantee upstream availability or establish professional provider access.
