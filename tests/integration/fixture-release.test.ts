import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFixtureRelease } from '../../packages/exporter/src/build-release';

describe('fixture to public release', () => {
  it('is deterministic and produces qualified static routes', async () => {
    const root = path.resolve(process.cwd());
    const first = await buildFixtureRelease(root);
    const firstManifest = await readFile(path.join(root, 'public', 'data', 'manifest.json'), 'utf8');
    const second = await buildFixtureRelease(root);
    const secondManifest = await readFile(path.join(root, 'public', 'data', 'manifest.json'), 'utf8');
    expect(second).toEqual(first);
    expect(secondManifest).toEqual(firstManifest);
    expect(second.donorPages).toBeGreaterThan(0);
  });
});
