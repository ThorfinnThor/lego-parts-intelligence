# Data source register

## Rebrickable

Review date: **2026-08-31**. Technical state: `approved_with_conditions`. Commercial production state: **blocked**.

This record separates Rebrickable's permission to use catalogue data from the intellectual-property rights in images and LEGO branding. It records a source-policy review, not legal advice.

### Current decision

| Area | Decision | Basis and implementation |
|---|---|---|
| Rebrickable catalogue/API data | Allowed for commercial use with conditions | Rebrickable Terms of Service section 5.1 expressly permits any purpose, including commercial use. Public attribution remains `Data sourced from Rebrickable.` |
| Bulk catalogue downloads | Allowed | Rebrickable section 5.1 points full-catalogue users to its Downloads page. The ingest workflow uses the ten canonical snapshot files instead of full-catalogue API pagination. |
| Set, part, and minifigure images | Disabled | Rebrickable section 5.2 permits external use but section 6.1 says the relevant intellectual property belongs to LEGO and LEGO rules still apply. LEGO's current Fair Play policy limits unofficial-site use to non-commercial purposes and requires formal permission or a written licence for third-party commercial or marketing use. No such permission is on file. |
| MOC images | Prohibited | Rebrickable section 5.2 says MOC images may not be used. Schema and exporter validation permanently reject them. |
| Automated image downloads | Prohibited outside the allowed Downloads path | No crawler or image-downloading automation is implemented. Even allowed catalogue image URLs are stripped while the image-rights gate is false. |
| AI training | Prohibited | Rebrickable section 5.3 prohibits using Rebrickable content to train AI models. The project does not use source content for model training. |
| Display ads | Blocked | Monetized use is not enabled without documented LEGO commercial permission and completed operator/legal approval. |
| Affiliate links | Blocked | The same LEGO commercial-use issue applies; any future partner program also requires a separate review. |
| Production approval | Blocked | `productionApproval` remains false. Preview builds remain non-indexable and non-monetized. |

Official sources reviewed:

- [Rebrickable Terms of Service](https://rebrickable.com/terms/), sections 5.1, 5.2, 5.3, and 6.1.
- [Rebrickable API](https://rebrickable.com/api/) and [API v3 documentation](https://rebrickable.com/api/v3/docs/).
- [LEGO Fair Play](https://www.lego.com/en-us/legal/notices-and-policies/fair-play/) and the linked [Fair Play brochure](https://www.lego.com/cdn/cs/legal/assets/blt1a4c9a959ce8e1cb/LEGO_Fairplay_Nov2018.pdf?pubDate=20250703).

### Technical controls

- Bulk-download first; no full-catalogue API pagination.
- Source downloads and every redirect are restricted to HTTPS hosts under `rebrickable.com`.
- Workflow filenames are restricted to the ten canonical snapshot files, including minifigures and set-to-minifigure inventories.
- A complete snapshot and required CSV headers are validated before a non-fixture build.
- Attribution is displayed in the global footer and source page.
- `externalSetPartMinifigImages: false` causes the exporter to omit all catalogue image URLs.
- MOC images remain non-representable in source configuration and are rejected by export validation.
- Ads and affiliate links are blocked in both source and legal configuration.
- Production export still requires `productionApproval: true` and a complete approved `config/legal-release.json`.
- The policy review is due again on 2026-11-30, or sooner if either provider changes its terms.

### Remaining approval checklist

- [x] Review current Rebrickable commercial catalogue-use terms.
- [x] Review current Rebrickable image and automation terms.
- [x] Review current LEGO Fair Play commercial-use restrictions.
- [x] Disable catalogue images until written permission is documented.
- [x] Block display ads and affiliate links under the current evidence.
- [ ] Obtain written LEGO permission/licence or a qualified legal opinion defining a narrower permitted commercial implementation.
- [ ] Review every affiliate program separately after the IP gate is resolved.
- [ ] Complete and approve `config/legal-release.json` with operator, contact, imprint, privacy, and review details.
- [ ] Set `productionApproval: true` only after all remaining gates pass.

Data sourced from Rebrickable.
