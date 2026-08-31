# Progressive SEO indexation plan

The public catalogue separates **catalogue coverage** from **Google indexation**. A record can be available to users through the static release without being selected for the XML sitemap or the indexable launch cohort.

## Initial release

The initial cohort uses `config/launch-cohort.json`:

- minimum: 250 qualified pages;
- target: 500 qualified pages;
- hard ceiling: 750 pages.

The selector may only choose pages that pass their page-type indexability gate. It must never create or retain a page merely to fill a numeric quota. The first cohort should contain a representative mix of parts, sets, minifigures, donor pages, relationships, and a small number of guide/ranking pages.

## Expansion gates

Expansion is a product decision, not an automatic consequence of having more source rows. Before increasing the ceiling, the operator records a release audit covering:

1. indexed/submitted ratio and “crawled - currently not indexed” patterns;
2. impressions and useful queries by page type;
3. duplicate, near-duplicate, and zero-value page samples;
4. internal-link discovery and sitemap coverage;
5. build time, asset count, and monthly operator cost.

Each page type must show evidence of user value before its quota is increased. Weak templates are reduced or removed from the sitemap; unused capacity is not a reason to publish them.

Suggested ceilings are 1,500 and 3,000 pages after the initial 750-page stage. Expansion beyond 5,000 pages requires a new product decision record and a fresh thin-content review. There is no automatic 5,000-page minimum.

## Content standard

Pages should provide more than a keyword-targeted label: documented source rows, transparent calculations, meaningful relationships, clear limitations, and useful links to adjacent records. Generated copy must not be used to make otherwise equivalent pages appear unique.

This follows Google's guidance to prioritize helpful, reliable, people-first content and to exclude scaled pages that provide little or no added value:

- <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- <https://developers.google.com/search/docs/essentials/spam-policies>
- <https://developers.google.com/search/docs/fundamentals/using-gen-ai-content>

## Cloudflare implication

The public plane remains a Next.js static export served by Cloudflare Workers Static Assets. A smaller indexation cohort also keeps the asset count, sitemap size, build time, and preview/rollback surface comfortably within the free-tier budget. No D1, KV, R2, or runtime Worker read is introduced for this policy.
