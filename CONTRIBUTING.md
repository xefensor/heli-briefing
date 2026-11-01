# Contributing

Read [AGENTS.md](AGENTS.md) and the [product brief](docs/product-brief.md) first. The repository contains the published evaluation application and its research, integration decisions and release evidence.

## Changes

1. Identify the requirement or question being addressed and inspect the relevant documentation.
2. Keep the change focused. Preserve confirmed requirements and label new recommendations as proposals.
3. For factual research, link the original source and record when it was checked. Keep parameter definitions, access conditions and geographic scope attached to claims.
4. Update affected documentation and the [decision register](docs/decisions/README.md) when appropriate.
5. Run `python3 scripts/check_docs.py` and `git diff --check` from the repository root.
6. Describe the final change and validation in the commit or pull request. State any unresolved gap.

Use descriptive branches for subsequent work. Reconcile concurrent changes before updating a branch; avoid force pushes. An authorised initial repository setup may be committed directly to its empty default branch.

## Reporting data problems

Include the provider and product, model if applicable, location, selected time, issue/run/observation time, retrieval time and the field affected. Distinguish missing data, stale data, mismatched time, wrong units, wrong height reference and forecast disagreement.

A forecast that differs from the weather encountered is not automatically a parser defect. Preserve enough evidence to distinguish provider output from processing and display errors. Redact credentials, private operational details and signed URLs before attaching a sample.

## Sources and assets

Summarise and link research; do not copy articles, forum threads, manuals or screenshots into the repository without verified permission. Dataset licensing and the project's own licence are separate decisions. The project licence is still open.

No credentials are required for the documentation checks. Use `npm test`, `npm run build` and the development commands in the [deployment guide](docs/deployment.md). Application tests do not require live provider access.
