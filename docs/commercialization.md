# Commercialization plan

## Positioning

The differentiator is not another searchable parts list. It is transparent catalogue intelligence: documented part and minifigure occurrences, component inventories, variant relationships, inventory-oriented donor rankings, and useful long-tail research pages with clear claim boundaries.

## Revenue sequence

1. **Validate search demand first.** Launch a small 250–500 page quality-gated cohort and measure indexation, impressions, donor-page engagement, and outbound intent before expanding.
2. **Affiliate tests second.** Add only approved partners and direct destinations. Use explicit disclosure plus `rel="sponsored nofollow"`; never add an open redirect.
3. **Display ads only after legal approval.** The component exists but deliberately renders nothing, and the build blocks an illegal enablement.
4. **Premium workspace later.** Saved inventories, wanted lists, project coverage, and multi-part donor tools are the strongest subscription candidates. Keep them in a separate authenticated runtime service.
5. **Data/API licensing only with source permission.** Public JSON files are an internal delivery format, not a commercial resale API.

## Commercial metrics

- indexed pages / submitted pages by template;
- impressions and clicks per page type;
- donor-page open rate from part pages;
- affiliate outbound rate by page type and partner;
- zero-impression page ratio;
- build time, asset count, and operator hours/month;
- gross contribution after hosting, data licenses, and partner fees.

`pnpm report:readiness` produces the machine-readable and Markdown launch-gate report used by the release workflow. Cloudflare Web Analytics should be enabled through automatic injection only after the final proxied production hostname exists; this preserves the current CSP and avoids a manually embedded third-party script. Cloudflare Web Analytics does not currently provide custom product events, so donor, relationship, search, and affiliate intent metrics need a separately approved event design before implementation.

## Product and legal gates

- No market-price, availability, or “best value” language without a licensed provider.
- No functional compatibility claim inferred from visual similarity.
- No ad or affiliate activation from environment variables alone; configuration approval is also required.
- No expansion beyond the initial 750-page ceiling until indexation, template value, crawl health, and operator cost are demonstrated in Search Console and the release audit.
- Keep source/provider logic outside UI and scoring so a licensing change can be handled without a rewrite.

## Suggested first paid feature

After organic intent is demonstrated, build a private multi-part donor workspace: users enter a wanted list and see set coverage, missing quantities, and reusable inventory. It extends the existing scoring contracts, has clear user value, and can be monetized without turning the public catalogue into a dynamic database application.
