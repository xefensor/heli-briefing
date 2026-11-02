# 0012 · Ordinary-browser runtime

Date: 2026-11-02. Status: owner constraint confirmed; prototype checkpoint completed. Main integration subsequently implemented by [decision 0013](0013-direct-browser-integration.md). The checkpoint description below is historical.

## Context

The owner found stale cameras. Investigation showed that the latest scheduled deployment had collected them at 01:55 UTC while the source offered newer frames. The application polled unchanged published snapshots. The owner then explicitly required client-side runtime, rejected extensions, considered but did not select a native app, and asked for an ordinary-browser solution.

## Decision

Treat ordinary-browser execution as the runtime target. GitHub Pages may host code and assets. Do not add a project-operated data backend, CORS proxy, extension, app or scheduled weather collector to solve access restrictions. This supersedes those earlier architecture proposals and collector implementation choices as the target, without rewriting the historical verification records.

Implement and verify a separate direct-source prototype before replacing the production path. It uses browser-readable ČHMÚ SWIM TAC reports, EUMETSAT WMS imagery, normal image loading for observed radar and the official municipal camera viewer. Record actual source times, partial coverage, export limitations and unsupported products. The three original ČHMÚ cameras are not relabelled as the municipal view.

The main briefing remains on the earlier snapshot path in this checkpoint. A successful prototype is not completed production migration. The [feasibility record](../browser-only-feasibility-2026-11-02.md) documents what can be integrated and the source capabilities that cannot currently be preserved unchanged.

## Consequences

Direct runtime refresh can be independent of code deployment for compatible sources. The eight core forecast graphs, existing terrain queries and astronomical calculations already fit the client model. Access-compatible reports and satellite adapters can retain local calculations and frozen output.

SWIM does not establish full foreign-station, initial twelve-hour history or current SIGMET coverage. Radar display is possible but its bytes cannot be frozen without CORS permission. Original camera/chart APIs and the current native ceiling product still require provider cooperation, a compatible alternate source or a deliberate functionality decision. Do not silently delete them or substitute a different meteorological quantity.

Licence, professional access and intended-pilot/native-output acceptance remain independent gates in the [release checklist](../release-checklist.md).
