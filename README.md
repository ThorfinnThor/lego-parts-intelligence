# Parts Intelligence

A static-first catalogue intelligence product for LEGO parts, designed for commercial operation on Cloudflare with no public runtime database dependency.

Hosting policy: **Cloudflare only**. Preview and production deployments use Cloudflare Workers Static Assets through Wrangler; the repository contains no alternative hosting deployment path.

The repository currently ships a complete, deterministic fixture release: CSV validation, canonical normalization, part statistics, donor scoring, rights gates, public JSON contracts, static search, accessible page templates, SEO output, and Cloudflare deployment verification. The same build consumes a complete approved Rebrickable bulk snapshot when `SOURCE_SNAPSHOT_DIR` is set. A real public launch remains intentionally blocked until the operator approves the current source terms and supplies that snapshot.

## Why this Cloudflare architecture

The public site is a pure Next.js static export deployed with **Workers Static Assets**. There is no Worker script, so matching asset requests do not consume Worker request or CPU quotas. The build measures Cloudflare's file limits before every deploy.

- Free tier: up to 20,000 files per Worker version.
- Workers Paid: up to 100,000 files per Worker version.
- Individual asset: up to 25 MiB.
- Static asset requests: free and unlimited.

The planned 5,000–10,000 page launch should use Workers Paid if the measured Next.js artifact exceeds 20,000 files. This trades a small fixed platform cost for a much safer asset ceiling while keeping traffic-driven compute cost at zero.

## Local development

Requirements: Node 24 and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The fixture data is rebuilt before Next.js starts. Open `http://localhost:3000`.

## Verification

```bash
pnpm verify
pnpm cf:dry-run
```

`pnpm verify` runs lint, strict TypeScript, unit/contract/integration tests, the public static-route scanner, a full static build, public contract checks, and Cloudflare asset-limit checks.

## Deterministic launch cohort

`config/launch-cohort.json` defines the 5,000-page minimum, 7,500-page target, 10,000-page ceiling, and page-type targets. The exporter scores only already-qualified part, donor, relationship, set-support, ranking, and methodology pages. Hard-blocked pages never fill a quota; unused quota is reassigned to the highest-scoring qualified candidates.

Every build writes the exact selected routes, per-type coverage, exclusions, scores, and methodology to `artifacts/launch-cohort/`. Production CI retains this audit for 90 days. Only selected dynamic routes are rendered, searched, internally linked, and emitted into segmented sitemaps, which keeps indexable-page and Cloudflare asset growth bounded.

## Cloudflare deployment

1. Set `APP_BASE_URL` to the production custom domain.
2. Set `CLOUDFLARE_ASSET_TIER=paid` if the build reports more than 20,000 assets.
3. Add scoped GitHub environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. In `config/data-sources.json`, set `productionApproval: true` only after operator/legal review.
5. Record the required Sol reviews in the release checklist.
6. Run the manual `Production release` workflow with the confirmation inputs.

Pull requests from this repository use `wrangler versions upload --preview-alias pr-<number>`. This creates a Cloudflare Workers preview version without assigning production traffic. Preview builds add global `noindex`, block crawlers through `robots.txt`, verify the complete static artifact, and smoke-test the aliased `workers.dev` URL. Fork and Dependabot pull requests skip deployment while retaining CI and CodeQL checks.

The production workflow sets `PRODUCTION_RELEASE=1`; this makes the build fail if the legal gate is closed, the canonical domain is missing, or fewer than 5,000 qualified pages exist.

## Source import

Bulk downloads are preferred over API pagination. The adapter streams a named approved URL to disk, enforces a size limit, retries failures, and writes SHA-256 metadata:

```bash
pnpm data:download -- --url=https://approved-source.example/file.csv --name=parts.csv --snapshot-dir=work/source-snapshots/rebrickable-v1
```

Source URLs are not hard-coded because their current official values and usage terms must be revalidated before ingestion.

Run the downloader once per approved CSV, reusing the same `--snapshot-dir`; its manifest accumulates checksums and source URLs. Compressed archives must be unpacked into the eight canonical CSV filenames before validation.

After all eight expected CSV files have been downloaded into one snapshot directory, validate and build it with:

```bash
SOURCE_SNAPSHOT_DIR=work/source-snapshots/2026-08-16 pnpm data:validate
SOURCE_SNAPSHOT_DIR=work/source-snapshots/2026-08-16 pnpm data:build
```

The importer checks required headers, reports non-breaking extra columns, rejects incomplete snapshots and broken foreign keys, and records the snapshot label in `manifest.json`. It parses files through Node streams; canonical rows are still materialized for deterministic scoring and export.

## Commercial safeguards

- Display ads and affiliate links default to disabled.
- Enabling ads while the machine-readable legal gate is closed fails the build.
- MOC images are unrepresentable in the source contract and blocked by path checks.
- Donor scoring contains no price or value claims.
- Every derived score and public artifact carries a methodology or release version.
- The `/legal/` placeholder must be replaced before production.

See [commercialization.md](docs/commercialization.md), [data-sources.md](docs/data-sources.md), and [cloudflare-operations.md](docs/cloudflare-operations.md).

## Model routing

Luna High is sufficient for routine repository work, fixtures, UI, SEO templates, CI maintenance, adapters, and deterministic tests. Sol High review is required before a commercial public release of the donor engine, static exporter, public data layer, release pipeline, and the initial 5k–10k cohort.

## Trademark and attribution

Data sourced from Rebrickable. This independent project is not affiliated with, authorized by, or endorsed by the LEGO Group. LEGO is a trademark of the LEGO Group.

Copyright © 2026. All rights reserved; no open-source license is granted by this repository.
