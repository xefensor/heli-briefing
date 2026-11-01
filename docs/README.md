# Documentation

Start with the product brief, then follow the evidence and implementation constraints for the area being changed. Research was checked on **1 November 2026**. A first evaluation implementation now exists in `web/`; the design and broader architecture remain proposals unless an implementation decision states otherwise. Read the deployment guide for current commands and distinguish implemented source from verified publication or pilot validation.

| Document | Purpose |
| --- | --- |
| [Product brief](product-brief.md) | Confirmed requirements, audience assumptions and unresolved product scope. |
| [Original site](research/original-site.md) | Contextual inventory of actual controls, candidate information needs, print intent and implementation defects; evaluated against the three research tracks. |
| [Design](design.md) | Information hierarchy, interaction proposals and product acceptance criteria. |
| [Pilot needs](research/pilot-needs.md) | Structured pilot research, forum evidence, limitations and implications. |
| [Interface references](research/interface-references.md) | Documented patterns from helicopter and aviation tools, with source and illustration dates. |
| [Data sources](data/sources.md) | Provider catalogue, access routes, licensing, coverage, parameters and sampled availability. |
| [Data integrity](data/integrity.md) | Time, units, vertical references, missing values, report validity and failure handling. |
| [Native cloud heights](data/cloud-heights.md) | Implemented DWD native-grid CEILING ingestion, MSL definition, regional coverage, timestamps and verified sample. |
| [Architecture](architecture.md) | Proposed responsibilities and data contracts without selecting an application stack. |
| [Release checklist and support](release-checklist.md) | Current completion boundary, pilot acceptance script, source outages, retention and external dependencies. |
| [Roadmap](roadmap.md) | Work stages, dependencies and evidence required to move forward. |
| [Build and deployment](deployment.md) | Current static application commands, GitHub Pages setup, report refresh and provider access limits. |
| [First-build hosting decision](decisions/0004-github-pages-first-build.md) | Browser-native implementation, owner-selected GitHub Pages and the deployment-time data path. |
| [Decision register](decisions/README.md) | Confirmed decisions, proposals and questions still open. |

## Reading status correctly

**Confirmed requirement** means the owner explicitly requested it. **Documented finding** describes a source or a dated observation. **Proposed** identifies a design or engineering recommendation awaiting a substantive implementation decision. **Open** means no choice has been made.

Historical screenshots demonstrate the pattern shown at that date. API samples show the response obtained during the stated check. Neither establishes current feature availability, complete station coverage or an uptime guarantee.

## Updating the documentation

Keep the current recommendation near its evidence. When a provider changes, update its catalogue entry, capability assumptions and affected decisions together. Preserve dated findings that explain a decision, but mark them historical when they no longer describe the service.

Maintain source URLs rather than internal chat reference IDs. Prefer primary provider documentation, original pilot accounts and original studies. Do not turn repeated anecdotes into a statistical claim.

Repository guidance is in [AGENTS.md](../AGENTS.md); the project overview is in [README.md](../README.md).
