import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataSourceConfigSchema, legalReleaseConfigSchema } from '../packages/data-contracts/src/index';
import { evaluateReleaseReadiness, readinessIsLaunchable } from '../packages/release-governance/src/readiness';
import { stableJson } from '../packages/exporter/src/stable-json';

const root = process.cwd();
const source = dataSourceConfigSchema.parse(JSON.parse(await readFile(path.join(root, 'config', 'data-sources.json'), 'utf8')));
const legal = legalReleaseConfigSchema.parse(JSON.parse(await readFile(path.join(root, 'config', 'legal-release.json'), 'utf8')));
const launchConfig = JSON.parse(await readFile(path.join(root, 'config', 'launch-cohort.json'), 'utf8')) as {
  minPages: number;
  targetPages: number;
};
const cohort = JSON.parse(await readFile(path.join(root, 'out', 'data', 'cohort-summary.json'), 'utf8')) as {
  totalPages: number;
};
const wrangler = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8')) as {
  main?: unknown;
  assets?: { binding?: unknown; run_worker_first?: unknown };
};
const assets = await listFiles(path.join(root, 'out'));
const releaseDate = process.env.READINESS_DATE ?? new Date().toISOString().slice(0, 10);
const checks = evaluateReleaseReadiness({
  releaseDate,
  appBaseUrl: process.env.APP_BASE_URL,
  source,
  legal,
  launch: { totalPages: cohort.totalPages, minPages: launchConfig.minPages, targetPages: launchConfig.targetPages },
  assets: { count: assets.length, freeLimit: 20_000 },
  staticRuntime: !('main' in wrangler) && !wrangler.assets?.binding && !wrangler.assets?.run_worker_first,
  requestedMonetization: {
    displayAds: process.env.ENABLE_DISPLAY_ADS === 'true',
    affiliateLinks: process.env.ENABLE_AFFILIATE_LINKS === 'true',
  },
});
const launchable = readinessIsLaunchable(checks);
const report = { schemaVersion: 1, generatedAt: `${releaseDate}T00:00:00.000Z`, launchable, checks };
const reportDirectory = path.join(root, 'artifacts', 'release-readiness');
await mkdir(reportDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(reportDirectory, 'report.json'), stableJson(report), 'utf8'),
  writeFile(path.join(reportDirectory, 'report.md'), markdownReport(report), 'utf8'),
]);
console.log(JSON.stringify({ event: 'release_readiness_reported', launchable, blocked: checks.filter((check) => check.status === 'blocked').map((check) => check.id) }));

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  }));
  return nested.flat();
}

function markdownReport(reportValue: { launchable: boolean; checks: typeof checks }): string {
  const rows = reportValue.checks.map((check) => `| ${check.id} | ${check.status} | ${check.detail.replaceAll('|', '\\|')} |`);
  return [
    '# Release readiness',
    '',
    `Overall: **${reportValue.launchable ? 'launchable' : 'blocked'}**`,
    '',
    '| Check | Status | Detail |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
