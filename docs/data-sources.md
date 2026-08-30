# Data source register

## Rebrickable

Technical state: `approved_with_conditions` for fixture development. Production state: **not approved**.

The implementation assumes, based on the supplied planning material, that official Rebrickable catalogue data and approved part/set images may be used in an external commercial application with attribution. That assumption must be revalidated against the complete current terms before launch; this repository does not make a legal determination.

Controls implemented:

- bulk download first; no full-catalogue API pagination;
- public attribution in the global footer and data-source page;
- MOC images are blocked by schema and export validation;
- display ads are blocked pending full terms-context review;
- affiliate links are blocked pending partner-specific review;
- production export requires explicit `productionApproval: true`;
- quarterly `reviewDueAt` is stored in machine-readable configuration.

Operator launch checklist:

- [ ] Archive the complete terms snapshot and its source URL.
- [ ] Confirm commercial catalogue use.
- [ ] Confirm external image use and exact attribution wording.
- [ ] Confirm the advertising/solicitation clause in full context.
- [ ] Review each affiliate program separately.
- [ ] Replace the legal-page placeholder.
- [ ] Set `productionApproval: true` with a reviewed date and owner.

Data sourced from Rebrickable.
