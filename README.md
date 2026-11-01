# Heli Briefing

A helicopter weather and briefing workspace for a South Bohemian professional pilot preparing briefings for others, with regional context for Czechia and Central Europe.

The goal is to bring a regional weather picture, detailed graphs, local observations and source comparison into a coherent interface with few repeated actions. Information depth and simple interaction are both requirements.

**Status:** research and documentation foundation. This repository does not yet contain the new application. The pilot-authored original Google Site is the content and workflow reference; its layout and implementation defects are not a requirement to copy. The exact reporting schedule, application stack, hosting and some data agreements remain open.

## Start here

- [Documentation index](docs/README.md)
- [Product brief and confirmed requirements](docs/product-brief.md)
- [Original site content and workflow](docs/research/original-site.md)
- [Design principles and proposed interactions](docs/design.md)
- [Pilot needs and evidence](docs/research/pilot-needs.md)
- [Interface references](docs/research/interface-references.md)
- [Data sources and access](docs/data/sources.md)
- [Data integrity requirements](docs/data/integrity.md)
- [Proposed architecture](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Decision register](docs/decisions/README.md)

Research was checked on **1 November 2026**. Feed capabilities, access conditions and prices can change; dated observations are not uptime or accuracy guarantees.

## Working on the project

Read [AGENTS.md](AGENTS.md) before changing the repository and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

Run the documentation checks from the repository root:

```sh
python3 scripts/check_docs.py
git diff --check
```

The local link checker uses Python's standard library. It does not call weather providers or require credentials. Application build and test commands will be added when the implementation stack is selected.

## Data and licensing

The proposed weather stack combines ČHMÚ ALADIN, DWD ICON, ECMWF, official aviation reports and observed radar. Sources retain their own identities, validity periods and reuse conditions. Model forecasts, measurements and calculated astronomy are different products.

The [source catalogue](docs/data/sources.md) records access and licensing constraints. This repository does not currently redistribute third-party weather datasets or screenshots. A project code and documentation licence has not been selected; public repository access does not itself grant a reuse licence.
