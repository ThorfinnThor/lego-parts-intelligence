import path from 'node:path';
import { assertSnapshotDirectory, readSnapshotCsv } from '../packages/rebrickable/src/snapshot';

const directory = path.resolve(process.env.SOURCE_SNAPSHOT_DIR ?? path.join(process.cwd(), 'data', 'fixtures'));
await assertSnapshotDirectory(directory);

const counts: Record<string, number> = {};
for (const filename of [
  'colors.csv',
  'part_categories.csv',
  'themes.csv',
  'parts.csv',
  'sets.csv',
  'inventories.csv',
  'inventory_parts.csv',
  'part_relationships.csv',
]) {
  counts[filename] = (await readSnapshotCsv(directory, filename)).length;
}

console.log(JSON.stringify({ event: 'source_snapshot_validated', directory, counts }));
