import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSnapshotCsv, readSnapshotLabel, validateSnapshotDirectory } from '../../packages/rebrickable/src/snapshot';

describe('rebrickable snapshot adapter', () => {
  it('recognises the complete fixture contract and stable label', async () => {
    const directory = path.resolve(process.cwd(), 'data', 'fixtures');
    const validation = await validateSnapshotDirectory(directory);
    expect(validation.missingFiles).toEqual([]);
    expect(await readSnapshotLabel(directory)).toBe('fixtures-v1');
    expect((await readSnapshotCsv(directory, 'parts.csv')).length).toBe(9);
    expect((await readSnapshotCsv(directory, 'minifigs.csv')).length).toBe(2);
  });

  it('rejects a CSV with missing required headers', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'lego-snapshot-'));
    try {
      await writeFile(path.join(directory, 'colors.csv'), 'id,name\n1,Black\n', 'utf8');
      await expect(readSnapshotCsv(directory, 'colors.csv')).rejects.toThrow(/missing required headers/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
