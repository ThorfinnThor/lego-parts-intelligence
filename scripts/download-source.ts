import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { downloadSnapshotFile } from '../packages/rebrickable/src/download';
import { stableJson } from '../packages/exporter/src/stable-json';

const urlValue = process.argv.find((argument) => argument.startsWith('--url='))?.slice('--url='.length);
const nameValue = process.argv.find((argument) => argument.startsWith('--name='))?.slice('--name='.length);
if (!urlValue || !nameValue) {
  throw new Error('Usage: pnpm data:download -- --url=https://approved-source/file.csv.gz --name=parts.csv.gz');
}

const retrievedAt = new Date().toISOString();
const snapshotDir = path.join(process.cwd(), 'work', 'source-snapshots', retrievedAt.replace(/[:.]/g, '-'));
await mkdir(snapshotDir, { recursive: true });
const file = await downloadSnapshotFile({ url: new URL(urlValue), filename: nameValue, snapshotDir });
const manifest = { source: 'rebrickable', retrievedAt, files: [file], termsReviewVersion: '2026-08-16' };
await writeFile(path.join(snapshotDir, 'manifest.json'), stableJson(manifest), 'utf8');
console.log(JSON.stringify({ event: 'source_snapshot_downloaded', snapshotDir, ...file }));
