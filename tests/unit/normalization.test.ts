import { describe, expect, it } from 'vitest';
import { createStableSlug, normalizeDisplayString, shardPrefix } from '../../packages/normalization/src/index';

describe('normalization', () => {
  it('keeps a stable source ID in every slug', () => {
    expect(createStableSlug('3001', '  Brick 2 × 4  ')).toBe('3001-brick-2-4');
  });

  it('normalizes whitespace without changing display case', () => {
    expect(normalizeDisplayString('Brick\t2   x 4')).toBe('Brick 2 x 4');
  });

  it('uses two characters for deterministic shards', () => {
    expect(shardPrefix('3')).toBe('3_');
    expect(shardPrefix('3001')).toBe('30');
  });
});
