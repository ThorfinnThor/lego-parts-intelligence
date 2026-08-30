import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { publicPartDetailSchema, type PublicManifestV1 } from '../packages/data-contracts/src/index';

const root = process.cwd();
const outDir = path.join(root, 'out');
const files = await listFiles(outDir);
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
