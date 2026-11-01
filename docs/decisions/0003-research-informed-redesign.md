# Rebuild using all three research tracks

Date: 2026-11-01

Status: accepted

## Context

The owner first directed us to inspect the intended pilot's own Google Site rather than ask him to guess the workflow. Decision 0002 interpreted this too strongly as a content and workflow baseline. The owner then clarified that the original is an initial attempt to improve/rethink using the three research tracks already completed. Source inspection establishes page content and implementation, not validated priorities or daily use.

The confirmed primary user remains a South Bohemian professional helicopter pilot preparing reports for others. Rich data and graphs, few avoidable clicks, meaningful global source controls, helicopter character and genuinely working data remain owner requirements. A fixed shift schedule and operation-specific assumptions remain unconfirmed.

## Decision

Develop a fresh product from the confirmed goals and all three research tracks. Use the original as contextual evidence of possible information needs, local defaults, output intent and defects. Reconsider its content, section order, controls, calculations and workflow; no feature-parity requirement applies.

| Input | Role in the redesign |
| --- | --- |
| [Pilot needs](../research/pilot-needs.md) | Propose tasks, information priorities and ways to reduce repeated preparation. |
| [Aviation interfaces](../research/interface-references.md) | Propose coherent presentation and interactions across maps, graphs, reports, source selection and time context. |
| [Data sources](../data/sources.md) and [integrity requirements](../data/integrity.md) | Establish feasible capabilities with real coverage, correct definitions, timestamps, provenance and reuse rights. |
| [Original-site inventory](../research/original-site.md) | Supply candidate needs and implementation failures to evaluate within that synthesis. |

Owner-confirmed goals and constraints take priority. The research supplies evidence and recommendations with documented limits; it is not representative local validation or proof that a competitor's workflow fits this pilot.

For major original features and proposed additions, record a brief rationale to retain, rework, replace or defer. Connect the choice to a preparation task, relevant evidence, available data and useful interaction. Preserve the requested information depth while allowing substantial changes to the product structure. A feature's presence in the original does not make it mandatory; its absence does not make it low priority.

## Consequences

- Astronomy detail, chart grouping and horizon, station lists, regional products and report output are design decisions to evaluate rather than copy automatically.
- A regional map, cameras or route context may be prioritized when supported by the preparation task and feasible data. They remain proposals, not approved implementation scope.
- Printing is a plausible output candidate supported by an observed print button. The actual report preparation and delivery workflow remains open.
- The original audit and its defect findings remain valid. Incorrect values, invented fallbacks and misleading controls must not be reproduced.
- Repository work remains documentation only. No application stack, deployment or completed integration is established by this decision.

This supersedes the original-feature preservation mandate in [decision 0002](0002-original-site-workflow-baseline.md). It clarifies the research-first direction of [decision 0001](0001-research-before-rebuild.md), while retaining the original as useful evidence. See the [product brief](../product-brief.md) and [design brief](../design.md) for current proposals and open questions.
