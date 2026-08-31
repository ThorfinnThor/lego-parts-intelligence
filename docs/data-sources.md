# Data source register

## Rebrickable

Technical state: `approved_with_conditions` for fixture development. Production state: **not approved**.

The implementation assumes, based on the supplied planning material, that official Rebrickable catalogue data and approved part/set images may be used in an external commercial application with attribution. That assumption must be revalidated against the complete current terms before launch; this repository does not make a legal determination.

Controls implemented:

- bulk download first; no full-catalogue API pagination;
- source downloads and every redirect are restricted to HTTPS hosts under `rebrickable.com`;
- workflow filenames are restricted to the eight canonical snapshot files;
- the manual source workflow downloads all eight files in one run, streams official `.csv.gz` inputs into canonical CSV files, validates the complete snapshot, and archives one reproducible artifact;
- complete snapshot required: `SOURCE_SNAPSHOT_DIR` must contain the eight canonical CSV files before a non-fixture build;
- required CSV headers are checked at ingest and unexpected columns are logged for operator review;
- public attribution in the global footer and data-source page;
- MOC images are blocked by schema and export validation;
- display ads are blocked pending full terms-context review;
- affiliate links are blocked pending partner-specific review;
- production export requires explicit `productionApproval: true`;
- `config/legal-release.json` must be complete and set to `approved` before a production build can pass;
- quarterly `reviewDueAt` is stored in machine-readable configuration.

Operator launch checklist:

- [ ] Archive the complete terms snapshot and its source URL.
- [ ] Confirm commercial catalogue use.
- [ ] Confirm external image use and exact attribution wording.
- [ ] Confirm the advertising/solicitation clause in full context.
- [ ] Review each affiliate program separately.
- [ ] Complete and approve `config/legal-release.json` with operator, contact, imprint, privacy, and review details.
- [ ] Set `productionApproval: true` with a reviewed date and owner.

Data sourced from Rebrickable.
