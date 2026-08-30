# Release failed

1. Do not retry production blindly; the previously verified asset version remains live.
2. Read the first failing gate in CI: rights, cohort, test, build, asset limit, deploy, or smoke verification.
3. If asset count exceeded the selected tier, reduce low-value routes or deliberately switch `CLOUDFLARE_ASSET_TIER` to `paid` after confirming the account plan.
4. If rights or production approval failed, stop and route to the operator/legal owner.
5. If deployment succeeded but smoke verification failed, run `wrangler rollback <verified-version-id>` and record the event.
