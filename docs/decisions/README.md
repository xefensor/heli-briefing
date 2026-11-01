# Decision register

Keep owner-confirmed requirements separate from engineering recommendations. Source details belong in the [data catalogue](../data/sources.md); this register records choices and their status.

## Confirmed

| Decision | Basis |
| --- | --- |
| Use the `heli-briefing` repository for project documentation and guidance. | The owner created the repository and authorised setup through the GitHub connector. |
| [Build and publish the first version on GitHub Pages](0004-github-pages-first-build.md). | The owner explicitly authorised implementation and publication. Browser-native modules and a deployment-time report collector are the first-build implementation choices; publication must be verified separately. |
| [Complete the briefing data path in v0.2](0005-complete-briefing-data.md). | Current implementation scope extends the evaluation with monitoring, native ceiling data, structured reports/history, observed radar history and frozen briefing output. Completion/publication require their own checks. |
| [Rebuild using all three research tracks](0003-research-informed-redesign.md). | The owner clarified that the original is a starting point to improve/rethink using pilot-needs, aviation-interface and data-source research. Its features and workflow are not an accepted specification. |
| Use the original as contextual evidence before asking the owner to speculate. | The owner identified the primary user and directed us to inspect the pilot-authored page. Its information needs and defects are recorded in the [inventory](../research/original-site.md). |
| Preserve rich data and graphs while reducing repeated interaction. | Explicit owner feedback on previous iterations. |
| Keep meaningful global controls prominent, including forecast source selection. | Explicit owner feedback on header and source behaviour. |
| Use a helicopter theme; ABS styling is optional. | Explicit owner direction. |

## Proposed

| Proposal | Reason and unresolved dependency |
| --- | --- |
| ALADIN as the initial Czech forecast candidate, ICON as an independent comparison, ECMWF for wider outlooks. | Coverage and field availability support this split; local forecast accuracy has not been ranked by this project. |
| Broader backend adapters, bounded server caching and separate large-file ingestion. | The first static build uses a browser forecast adapter and deployment-time report collector. Private access and larger raw datasets need additional infrastructure; that stack remains open. |
| Coordinated map, detailed graphs, local evidence and optional route profile. | Supported by pilot research and interface references; exact first-version workflow and layout need validation. |
| A continuous viewing timeline with distinct observation, forecast and route-passage semantics. | Reduces duplicated navigation while preserving temporal meaning; exact controls remain a design choice. |

## Decision history

[Decision 0001](0001-research-before-rebuild.md) established the fresh start and research-first approach. [Decision 0002](0002-original-site-workflow-baseline.md) then anchored scope too strongly to the pilot-authored original. [Decision 0003](0003-research-informed-redesign.md) clarifies the current direction: keep the original as evidence and use the three research tracks to redesign the product. The primary user, information depth and low-friction requirements remain established.

[Decision 0004](0004-github-pages-first-build.md) records the owner's subsequent build/publication instruction and the first static implementation. It selects GitHub Pages and the initial data path without approving all proposed features or establishing professional production access. Current commands and initial enablement requirements are in the [deployment guide](../deployment.md).

[Decision 0005](0005-complete-briefing-data.md) records the v0.2 completion scope and native cloud ingestion/caching choice. The previously verified v0.1 deployment remains the release baseline until v0.2 checks and publication are recorded.

## Open

The primary user, initial South Bohemian context, first browser-native implementation and GitHub Pages target are established. Exact reporting cadence, additional operation-specific needs, extended geography, validated final interface layout, future backend/storage, code/documentation licence, paid services and remaining redistribution agreements remain open. Build and publication are authorised by the owner's explicit request; a successful deployment and professional operational suitability require separate evidence.

Use the [decision template](template.md) for a substantial new decision. Record date, status, context, choice, consequences and supporting sources. Mark a superseded decision and link its replacement instead of silently rewriting history.
