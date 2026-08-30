# ADR 0001: Cloudflare static public plane

Status: accepted for MVP.

The public catalogue is a Next.js static export deployed as Cloudflare Workers Static Assets without a Worker script. ETL and derived intelligence run at build time. Public pages and search read versioned local artifacts only.

This replaces the supplied Vercel hosting target and avoids public Supabase dependency. It also avoids D1/KV/R2 runtime reads, uses no Worker CPU, and makes deployments atomic at the asset-version boundary.

The cost is a build-time route/file ceiling. The release verifier measures that ceiling; use Workers Paid for up to 100,000 assets when the full cohort outgrows the 20,000-file free ceiling.
