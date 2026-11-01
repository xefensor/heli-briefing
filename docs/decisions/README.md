# Decision register

Keep owner-confirmed requirements separate from engineering recommendations. Source details belong in the [data catalogue](../data/sources.md); this register records choices and their status.

## Confirmed

| Decision | Basis |
| --- | --- |
| Use the `heli-briefing` repository for project documentation and guidance. | The owner created the repository and authorised setup through the GitHub connector. |
| [Start fresh with research before rebuilding](0001-research-before-rebuild.md). | The owner discarded earlier designs and requested pilot-needs, interface and data-source research. |
| Preserve rich data and graphs while reducing repeated interaction. | Explicit owner feedback on previous iterations. |
| Keep meaningful global controls prominent, including forecast source selection. | Explicit owner feedback on header and source behaviour. |
| Use a helicopter theme; ABS styling is optional. | Explicit owner direction. |

## Proposed

| Proposal | Reason and unresolved dependency |
| --- | --- |
| ALADIN as the initial Czech forecast candidate, ICON as an independent comparison, ECMWF for wider outlooks. | Coverage and field availability support this split; local forecast accuracy has not been ranked by this project. |
| Backend adapters, bounded caching and separate large-file ingestion. | Provider constraints and data size support these responsibilities; implementation stack remains open. |
| Coordinated map, detailed graphs, local evidence and optional route profile. | Supported by pilot research and interface references; exact first-version workflow and layout need validation. |
| A continuous viewing timeline with distinct observation, forecast and route-passage semantics. | Reduces duplicated navigation while preserving temporal meaning; exact controls remain a design choice. |

## Open

The primary operator/workflow, full geographical scope, final interface layout, framework, hosting, storage, code/documentation licence, paid services and redistribution agreements remain open. No application migration or deployment is authorised merely by a planning entry.

Use the [decision template](template.md) for a substantial new decision. Record date, status, context, choice, consequences and supporting sources. Mark a superseded decision and link its replacement instead of silently rewriting history.
