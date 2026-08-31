import { describe, expect, it } from 'vitest';
import {
  selectLaunchCohort,
  type LaunchCandidate,
  type LaunchCohortConfig,
  type LaunchPageType,
} from '../../packages/scoring/src/launch-cohort';

const components = {
  relationshipDepth: 0.5,
  occurrenceDepth: 0.5,
  derivedInsightCount: 0.5,
  internalLinkValue: 0.5,
  metadataCompleteness: 0.5,
};

function candidate(pageType: LaunchPageType, route: string, score = 0.5): LaunchCandidate {
  return { pageType, route, qualified: true, hardBlockReasons: [], components: { ...components, occurrenceDepth: score } };
}

const config: LaunchCohortConfig = {
  version: 'test-v1',
  minPages: 4,
  targetPages: 5,
  maxPages: 6,
  pageTypeTargets: { part: 2, donor: 2, relationship: 1, set_support: 0, minifig: 0, ranking_or_methodology: 0 },
};

describe('launch cohort selector', () => {
  it('reallocates an unavailable page-type quota deterministically', () => {
    const candidates = [
      candidate('part', '/parts/c/', 0.4),
      candidate('part', '/parts/a/', 0.9),
      candidate('part', '/parts/b/', 0.8),
      candidate('donor', '/donor-sets/a/', 0.7),
      candidate('donor', '/donor-sets/b/', 0.6),
    ];
    const first = selectLaunchCohort(candidates, config);
    const second = selectLaunchCohort([...candidates].reverse(), config);
    expect(first.selected.map((item) => item.route)).toEqual(second.selected.map((item) => item.route));
    expect(first.selected).toHaveLength(5);
    expect(first.byType.relationship.shortfall).toBe(1);
    expect(first.byType.part.selected).toBe(3);
    expect(first.launchReady).toBe(true);
  });

  it('never uses a blocked page to fill the minimum', () => {
    const blocked: LaunchCandidate = {
      ...candidate('part', '/parts/blocked/'),
      qualified: false,
      hardBlockReasons: ['thin_content'],
    };
    const result = selectLaunchCohort([
      candidate('part', '/parts/a/'),
      candidate('donor', '/donor-sets/a/'),
      blocked,
    ], config);
    expect(result.selected.map((item) => item.route)).not.toContain('/parts/blocked/');
    expect(result.excluded.find((item) => item.route === '/parts/blocked/')?.exclusionReason).toBe('hard_block');
    expect(result.launchReady).toBe(false);
  });
});
