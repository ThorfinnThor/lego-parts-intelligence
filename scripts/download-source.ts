import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { downloadSnapshotFile } from '../packages/rebrickable/src/download';
import { stableJson } from '../packages/exporter/src/stable-json';

const urlValue = process.argv.find((argument) => argument.startsWith('--url='))?.slice('--url='.length);
const nameValue = process.argv.find((argument) => argument.startsWith('--name='))?.slice('--name='.length);
const snapshotDirValue = process.argv.find((argument) => argument.startsWith('--snapshot-dir='))?.slice('--snapshot-dir='.length);
if (!urlValue || !nameValue) {
  throw new Error('Usage: pnpm data:download -- --url=https://approved-source/file.csv --name=parts.csv [--snapshot-dir=work/source-snapshots/rebrickable-v1]');
}

const retrievedAt = new Date().toISOString();
const snapshotDir = path.resolve(process.cwd(), snapshotDirValue ?? path.join('work', 'source-snapshots', retrievedAt.replace(/[:.]/g, '-')));
await mkdir(snapshotDir, { recursive: true });
const file = await downloadSnapshotFile({ url: new URL(urlValue), filename: nameValue, snapshotDir });
let existing: { files?: typeof file[]; snapshotId?: string } = {};
try {
  existing = JSON.parse(await readFile(path.join(snapshotDir, 'manifest.json'), 'utf8')) as typeof existing;
} catch {
  // First file in a new snapshot directory.
}
const files = [...(existing.files ?? []).filter((item) => item.name !== file.name), file].sort((left, right) => left.name.localeCompare(right.name));
const manifest = {
  source: 'rebrickable',
  snapshotId: existing.snapshotId ?? path.basename(snapshotDir),
  retrievedAt,
  files,
  termsReviewVersion: '2026-08-16',
};
await writeFile(path.join(snapshotDir, 'manifest.json'), stableJson(manifest), 'utf8');
console.log(JSON.stringify({ event: 'source_snapshot_downloaded', snapshotDir, ...file }));
