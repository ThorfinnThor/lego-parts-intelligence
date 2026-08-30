import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { publicPartDetailSchema, type PublicManifestV1 } from '../packages/data-contracts/src/index';

const root = process.cwd();
const outDir = path.join(root, 'out');
const files = await listFiles(outDir);
const outputFiles = new Set(files.map((file) => path.relative(outDir, file)));
const tier = process.env.CLOUDFLARE_ASSET_TIER ?? 'free';
const fileLimit = tier === 'paid' ? 100_000 : 20_000;
const maxAssetBytes = 25 * 1024 * 1024;
if (files.length > fileLimit) throw new Error(`Cloudflare ${tier} asset limit exceeded: ${files.length}/${fileLimit}.`);
for (const file of files) {
  const size = (await stat(file)).size;
  if (size > maxAssetBytes) throw new Error(`Cloudflare 25 MiB asset limit exceeded: ${path.relative(outDir, file)}.`);
}

const indexHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');
if (!indexHtml.includes('Data sourced from Rebrickable.')) throw new Error('Global source attribution missing from rendered HTML.');
if (!indexHtml.includes('<h1')) throw new Error('Home page lacks a server-rendered H1.');

const manifest = JSON.parse(await readFile(path.join(outDir, 'data', 'manifest.json'), 'utf8')) as PublicManifestV1;
const cohortConfig = JSON.parse(await readFile(path.join(root, 'config', 'launch-cohort.json'), 'utf8')) as {
  minPages: number; targetPages: number; maxPages: number;
};
const cohortSummary = JSON.parse(await readFile(path.join(outDir, 'data', 'cohort-summary.json'), 'utf8')) as {
  totalPages: number;
  launchReady: boolean;
  byType: { part: number; donor: number; relationship: number; set_support: number; ranking_or_methodology: number };
};
const launchPages = JSON.parse(await readFile(path.join(outDir, 'data', 'launch-pages.json'), 'utf8')) as Array<{
  pageType: string; route: string; launchPriorityScore: number;
}>;
if (launchPages.length !== cohortSummary.totalPages) throw new Error('Launch cohort page list and summary count differ.');
if (new Set(launchPages.map((page) => page.route)).size !== launchPages.length) throw new Error('Duplicate route in launch cohort.');
if (launchPages.length > cohortConfig.maxPages) throw new Error(`Launch cohort exceeds maxPages: ${launchPages.length}/${cohortConfig.maxPages}.`);
if (process.env.PRODUCTION_RELEASE === '1' && launchPages.length < cohortConfig.minPages) {
  throw new Error(`Production launch cohort is below minPages: ${launchPages.length}/${cohortConfig.minPages}.`);
}
const byTypeTotal = Object.values(cohortSummary.byType).reduce((sum, count) => sum + count, 0);
if (byTypeTotal !== launchPages.length) throw new Error('Launch cohort type counts do not sum to totalPages.');
if (manifest.counts.partPages !== cohortSummary.byType.part) throw new Error('Manifest part page count differs from cohort.');
if (manifest.counts.donorPages !== cohortSummary.byType.donor) throw new Error('Manifest donor page count differs from cohort.');
if (manifest.counts.relationshipPages !== cohortSummary.byType.relationship) throw new Error('Manifest relationship page count differs from cohort.');
if (manifest.routes.sets.length !== cohortSummary.byType.set_support) throw new Error('Manifest set-support page count differs from cohort.');
if (manifest.counts.rankings > cohortSummary.byType.ranking_or_methodology) throw new Error('Manifest ranking count exceeds cohort guide pages.');

const sitemapDirectory = path.join(outDir, 'sitemaps');
const sitemapFiles = (await readdir(sitemapDirectory)).filter((filename) => filename.endsWith('.xml'));
const sitemapXml = (await Promise.all(sitemapFiles.map((filename) => readFile(path.join(sitemapDirectory, filename), 'utf8')))).join('\n');
for (const page of launchPages) {
  if (!page.route.startsWith('/') || !page.route.endsWith('/')) throw new Error(`Invalid canonical cohort route: ${page.route}`);
  if (page.launchPriorityScore < 0 || page.launchPriorityScore > 1) throw new Error(`Invalid launch score: ${page.route}`);
  const html = await readFile(path.join(outDir, ...page.route.split('/').filter(Boolean), 'index.html'), 'utf8');
  if (!html.includes('<h1') || !html.includes('Data sourced from Rebrickable.')) {
    throw new Error(`Launch HTML contract failed: ${page.route}`);
  }
  if (!sitemapXml.includes(page.route)) throw new Error(`Launch route missing from segmented sitemaps: ${page.route}`);
}
for (const htmlFile of files.filter((file) => file.endsWith('.html'))) {
  const html = await readFile(htmlFile, 'utf8');
  for (const match of html.matchAll(/href="(\/[^"#?]*)[^"\s]*"/g)) {
    const href = match[1];
    if (!href || href.startsWith('//')) continue;
    const relativeTarget = href === '/'
      ? 'index.html'
      : href.endsWith('/')
        ? `${href.slice(1)}index.html`
        : href.slice(1);
    if (!outputFiles.has(relativeTarget)) {
      throw new Error(`Broken static internal link in ${path.relative(outDir, htmlFile)}: ${href}`);
    }
  }
}
for (const slug of manifest.routes.parts) {
  const id = slug.split('-')[0];
  if (!id) throw new Error(`Invalid part slug in manifest: ${slug}`);
  const shard = id.padEnd(2, '_').slice(0, 2).toLowerCase();
  publicPartDetailSchema.parse(JSON.parse(await readFile(path.join(outDir, 'data', 'parts', shard, `${id}.json`), 'utf8')));
  const html = await readFile(path.join(outDir, 'parts', slug, 'index.html'), 'utf8');
  if (!html.includes('<h1') || !html.includes('Data sourced from Rebrickable.')) {
    throw new Error(`Part HTML contract failed: ${slug}`);
  }
}

const publicData = await readFile(path.join(outDir, 'data', 'manifest.json'), 'utf8');
if (/SUPABASE_|REBRICKABLE_API_KEY|CLOUDFLARE_API_TOKEN/.test(publicData)) throw new Error('Secret field name leaked into manifest.');
console.log(JSON.stringify({
  event: 'release_verified',
  exportVersion: manifest.exportVersion,
  launchPages: launchPages.length,
  launchTarget: cohortConfig.targetPages,
  assets: files.length,
  assetLimit: fileLimit,
  utilizationPercent: Math.round((files.length / fileLimit) * 10_000) / 100,
  runtimeWorkerInvocations: 0,
}));

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  }));
  return nested.flat();
}
