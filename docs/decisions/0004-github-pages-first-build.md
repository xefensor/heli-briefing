# Build the first version as a static GitHub Pages application

Date: 2026-11-01

Status: accepted implementation choice; publication must be verified separately

## Context

The owner authorised building the first working version and explicitly requested publication on GitHub Pages. The product needs coordinated forecast controls, substantial charts, original aviation reports and readable briefing output. GitHub Pages serves static assets and does not provide a private runtime for API credentials or arbitrary backend requests.

## Decision

Implement the first version with browser-native JavaScript modules, HTML, CSS and SVG charts in `web/`. A dependency-free Node.js build copies only public assets into `dist/`. This keeps a small application maintainable without adding a framework or runtime service solely for deployment.

Use direct browser forecast requests where the provider permits them. For AviationWeather.gov's documented CORS limitation, use a bounded Python collector during deployment. GitHub Actions publishes its JSON snapshot with the application rather than committing periodic report changes to the source branch. Scheduled deployments attempt updates every twenty minutes; reports retain their original observation, issue and validity times. A deployment timestamp must not imply that an old bulletin is fresh.

Use the official GitHub Pages artifact and deployment actions, pinned to verified release commits. The build has read-only repository access; only the deployment job receives `pages: write` and `id-token: write`. No account token, provider key or production secret belongs in the static artifact.

## Consequences

- The owner-selected host is GitHub Pages. No additional Sites hosting project is needed for this implementation.
- Forecast and report failures must remain visible. Reports are periodically retrieved snapshots, not a live browser connection to AWC; scheduled jobs can run late or stop.
- Open-Meteo's free hosted API is used for this open-source evaluation version under its applicable terms. Production professional/commercial use requires suitable provider access and a server-side design for any private credentials. A paid subscription has not been purchased or configured.
- Provider rights and operational suitability remain separate from technical publication. Existing source limitations and data-integrity rules continue to apply.
- Initial GitHub Pages enablement is an administration setting. The ordinary Actions `GITHUB_TOKEN` cannot enable it through `configure-pages`; an authorised owner must select GitHub Actions as the publishing source when the repository does not already have Pages enabled. Do not invent a secret or request excessive workflow permissions to bypass this.
- Source preparation, a successful build, a pushed commit and a successful Pages deployment are distinct states. Record the returned deployment URL and verification result before saying the site is published.

See [deployment](../deployment.md), [source access](../data/sources.md) and [data integrity](../data/integrity.md).

## Sources

Checked 2026-11-01:

- [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
- [Configure Pages v6.0.0 action and enablement requirements](https://github.com/actions/configure-pages/blob/v6.0.0/action.yml).
- [Upload Pages artifact v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0).
- [Deploy Pages v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1).
- [Open-Meteo terms](https://open-meteo.com/en/terms) and [pricing/access distinction](https://open-meteo.com/en/pricing).
