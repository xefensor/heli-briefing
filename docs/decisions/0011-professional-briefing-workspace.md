# 0011 · Professional briefing workspace

Date: 2026-11-01. Status: implemented and published; see [deployment evidence](../deployment.md).

## Context

The owner requested a large review and a professional UI/UX redesign. The v0.3 evaluation had substantial working data but its page grew by appending panels. Controls were distributed across the header/page/forecast, station evidence was buried, imagery created long narrow stacks and mobile lost the global context on scroll.

## Decision

Implement the [review](../design-review-2026-11-01.md) using all three existing studies. Retain a single connected reading surface, eight directly visible forecast graphs, original reports, imagery, profiles, route and complete captured output. Replace the accumulated shared CSS overrides with a consistent foundation and responsive shell.

Use six direct task chapters with a desktop rail/phone bottom navigation and measured sticky-control offsets. Consolidate primary/comparison forecast controls with place, viewing time, zone and live/pinned state. Put actual nearby observations beside the forecast and a concise SIGMET source/time status near the page context. Keep complete regional reports, all station gaps and independent-product identity explicit.

Use navy, neutral surfaces and blue-green interaction accents for an aviation workspace. Reserve warning/error styles for evidence states; colours do not constitute flight approval. Use aligned numerical readings and readable source metadata rather than decorative cockpit instruments. Keep dark presentation and standalone briefing output visually coherent.

## Consequences

The site becomes easier to scan and navigate without removing data or adding a mode switch for each task. Supporting report methodology appears once while original text and exceptional warnings stay local. Image/model/source controls retain stable focus across refresh, input semantics are corrected, and the primary handoff is clearly distinguished from printing live content.

This is an authorized implementation choice, not an owner confirmation of every visual detail, a pilot usability result or professional operational approval. Provider adapters, field definitions, report parsers, access and release gates remain in force. See the [release checklist](../release-checklist.md) and [deployment evidence](../deployment.md).
