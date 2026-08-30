# Model routing

Use Luna High for deterministic implementation and maintenance:

- repository/build setup;
- Cloudflare configuration;
- schemas, fixtures, adapters, UI, accessibility, SEO, and CI;
- ordinary parser and exporter changes covered by existing contracts;
- test writing and release-report automation.

Require Sol High review before production for:

- donor-v1 semantics and edge cases;
- static export integrity, determinism, and secret exclusion;
- zero-runtime-database public data contract;
- atomic deploy/rollback behavior;
- final 5,000–10,000 page cohort and thin-content audit.

Routine work currently remaining—real snapshot field mapping, adding page templates under established contracts, and CI maintenance—is suitable for Luna. Methodology changes or production release audits should use Sol.
