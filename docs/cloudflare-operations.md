# Cloudflare operations and limit budget

## Runtime design

`wrangler.jsonc` points directly at `./out` and defines no `main` entry point. Cloudflare therefore serves the static export without invoking Worker code. Do not add `run_worker_first`, middleware, SSR, or an asset binding for the public catalogue unless a measured product need justifies the new cost and failure mode.

Current platform budget (revalidate before production):

| Constraint | Free | Workers Paid | Repository control |
|---|---:|---:|---|
| Static files/version | 20,000 | 100,000 | `verify-release.ts` hard limit |
| File size | 25 MiB | 25 MiB | `verify-release.ts` hard limit |
| Static asset requests | free/unlimited | free/unlimited | no Worker script |
| Worker requests | not used | not used | no `main` property |

The build reports both asset count and ceiling utilization. Use the paid ceiling for the full 7,500-page cohort if free utilization would exceed 90%; operating at the exact limit leaves no room for Next.js framework files or rollback growth.

The launch selector limits generated dynamic HTML to the selected cohort and emits separate `parts`, `donor-sets`, `relationships`, `set-support`, and `rankings-and-methodology` sitemap segments. JSON is emitted only for selected pages or records required by a selected relationship page. This makes the asset-limit check reflect the actual launch portfolio instead of the entire source catalogue.

## Build and deploy

```bash
APP_BASE_URL=https://your-domain.example \
CLOUDFLARE_ASSET_TIER=paid \
pnpm verify

pnpm cf:dry-run
pnpm cf:deploy
```

GitHub production deployment is manual and protected by an environment. Cloudflare credentials must be account-scoped, stored only as GitHub secrets, and limited to the target account.

## Atomicity and rollback

Every deploy packages HTML, JSON, search, and sitemaps from one `exportVersion`. Wrangler uploads a new Worker version atomically. List versions with `pnpm exec wrangler versions list`; rollback only to a release whose smoke verification previously passed.

## Scaling trigger

Do not add D1, KV, R2 reads, Durable Objects, Queues, or an SSR Worker to solve static catalogue traffic. R2 is appropriate only for private raw snapshots or large build artifacts. Add runtime services later for authenticated paid tools, isolated under a separate Worker/service so catalogue asset requests remain free.

Official references:

- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/get-started/
