# Saved operating points and time continuity

Date: 2026-11-01

Status: core iteration published; final asset-version deployment pending

## Context and three-study review

The owner asked for continuing implementation, UX refinement, a check of all three studies every substantial iteration and explicit whole-project completion reporting.

| Study checked | Implication for this iteration |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Off-airport coordinates and continuity during repeat checks justify named points that avoid repeated map selection. This is a design inference to validate locally, not evidence that every helicopter pilot wants saved points. |
| [Interface references](../research/interface-references.md) | Preserve geographic context and meaningful global controls. Put saved points in the existing location selector rather than adding a separate workflow or hiding the charts. |
| [Data sources](../data/sources.md) | A saved coordinate does not create an observation, extend a model domain or identify an approved landing site. Query the same explicit model; keep regional station identities, missing fields and independent imagery unchanged. |

No provider endpoint, field, access tier, licence or weather-processing definition changes in this iteration. This was a reread of the source study, not a new provider capability or terms verification.

A local browser check reproduced an existing continuity defect: pressing **Teď** showed **Živě**, but reloading silently changed to **Připnutý čas** because navigation always serialized the inspection instant.

## Decision

- Add direct WGS 84 decimal-coordinate entry and up to twenty named browser-local points. Accept decimal comma or point; validate ranges and preserve numeric zero. Round saved coordinates to five decimal places, consistent with navigation links; this is storage precision, not location accuracy.
- Use **Místo → Zadat / uložit bod…** for entry and management. Saved points appear directly in the existing selector. Keep model, comparison, horizon, timezone and live/pinned state when changing points.
- Offer **Uložit a použít** and **Použít bez uložení**, so a temporary point needs no persistent record. Support editing and deletion with immediate undo. Reject coordinate collisions and a full collection without silently evicting points.
- Store only name and coordinates under a versioned local key. Do not upload the collection, restore old weather or infer a landing site's status. Unreadable/unsupported storage is not overwritten; show failures and retain temporary use.
- Omit `time` from live navigation URLs. Reload remains live; a deliberately pinned selection retains its absolute instant. Existing timestamp-bearing links remain pinned and backwards compatible.
- **Kopírovat odkaz** always constructs a timestamp-bearing inspection link without changing the current page's live mode. Explain that recipients retrieve data afresh. The frozen briefing remains the path for preserving actual captured data. A labelled selectable input handles denied clipboard access.
- Use N/S/E/W labels consistently for entered coordinates in the main context and saved HTML/text; do not display a negative latitude as north or a negative longitude as east.

## Release consistency

The core saved-point deployment succeeded, but a subsequent live check still showed the old alias-selection behavior after its correction had deployed. Cache reuse or deployment propagation is the inference; browser network/cache internals were not inspected. The build now moves scripts, styles, favicon and vendored dependencies together under a content-derived `assets/<version>/` directory and rewrites the HTML entry URLs. Relative module imports remain intact. Runtime weather snapshots stay under `data/` with their original source timestamps and freshness behavior. Weather-only scheduled updates do not invalidate application assets; application/HTML changes produce a different version.

The first relocation regression also detected that unused default Leaflet marker/layer image files were never bundled in the original source. Current map rendering uses circle markers and no layer control; this iteration does not claim those unused icons are available. Add their licensed assets before using those Leaflet features.

## Alternatives and consequences

Remembering an entire previous session would also restore stale inspection times and requires a different preference decision. This iteration saves explicit points only. A shared/account-backed list would require identity/storage infrastructure, which remains unselected. A route editor is a separate task; points are not a route or terrain cross-section.

The editor keeps frequent use in one existing dropdown. Supporting entry/management lives in a keyboard-accessible native dialog, with readable input sizes, responsive actions, focused undo and an independent scroll area. Existing weather graphs and reports remain directly available.

## Validation

- Reproduced the old live-to-pinned reload defect before changing it; confirmed live reload afterward.
- Local browser checks: Czech decimal-comma entry, save/recall across reload, preserved ICON-D2/ECMWF comparison context, deletion/undo, invalid latitude rejection and a timestamp-bearing copied link while the page remained live.
- Narrow-screen check: 390 px QA viewport, 375 px content; dialog client and scroll widths match with no horizontal overflow. Input autofocus and stacked actions were visually inspected.
- Deterministic checks cover coordinate validation/zero, storage denial/quota/corruption/version handling, coordinate collisions, capacity without eviction, edit/delete/undo, time serialization and repeated-hour absolute instants.
- All 137 local tests passed (103 JavaScript and 34 Python); build emitted 30 static files; documentation checker passed for 26 tracked Markdown files. Pinned-time temporary-point selection and pinned reload were also confirmed in the local browser.
- Initial publication run [41326998280](https://github.com/xefensor/heli-briefing/actions/runs/41326998280) succeeded. Live HTTPS checks confirmed point save/recall across reload, live mode retained, timestamp-bearing clipboard sharing without pinning the sender, eight forecast charts and nine regional station rows. Final versioned-asset publication and alias verification will be recorded after completion.
- Build regressions verify every HTML asset and local module import resolves after relocation, and data-only changes leave the asset version stable while module changes change it. Native download/print verification and actual pilot validation remain outstanding.

## Whole-project status

The whole project is **not complete**. Full route/time/terrain sections, cameras, authorized aeronautical integrations, professional provider access, pilot validation and remaining native download/print checks are still open. Finishing this iteration does not close those items.
