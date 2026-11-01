# Use the pilot authored original as the content and workflow baseline

Date: 2026-11-01

Status: accepted

## Context

The owner identified the primary user as a South Bohemian professional helicopter pilot who prepares reports for others. A shift weather overview was described tentatively. When asked to speculate about report delivery, the owner directed us to use the original Google Site, which the pilot had made himself, to infer the actual content and workflow.

## Decision

Use the [original-site inventory](../research/original-site.md) as the content and workflow baseline. Retain its useful briefing scope, including substantial astronomy, weather graphs, regional reports, SWL and print intent. Derive observable requirements from the source before asking further questions. Ask only one material question at a time when an answer cannot be established from available evidence.

Build a fresh implementation and improve its design and data integrity. The original's layout, ineffective controls, fabricated fallbacks and misleading calculations are not requirements to reproduce.

## Consequences

The original's browser-print button provides a default preparation/output direction; it does not establish a custom PDF generator, report editor or distribution system. A fixed shift schedule, HEMS operation, aircraft capability and legal/operator minima remain unconfirmed.

This supersedes the original-site exclusion in [decision 0001](0001-research-before-rebuild.md), not its research-first direction or the rejection of previous redesigns.
