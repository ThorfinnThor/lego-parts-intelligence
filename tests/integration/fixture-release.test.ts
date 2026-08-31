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
    expect(second.minifigs).toBe(2);
    const cohort = JSON.parse(await readFile(path.join(root, 'public', 'data', 'cohort-summary.json'), 'utf8')) as {
      totalPages: number; byType: { relationship: number; minifig: number }; launchReady: boolean;
    };
    const launchPages = JSON.parse(await readFile(path.join(root, 'artifacts', 'launch-cohort', 'launch_pages.json'), 'utf8')) as unknown[];
    expect(cohort.byType.relationship).toBeGreaterThan(0);
    expect(cohort.byType.minifig).toBe(2);
    expect(launchPages).toHaveLength(cohort.totalPages);
    expect(cohort.launchReady).toBe(false);
  });
});
