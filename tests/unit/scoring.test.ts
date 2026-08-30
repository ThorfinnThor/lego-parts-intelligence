import { describe, expect, it } from 'vitest';
import { commonalityScore, scoreDonorCandidates } from '../../packages/scoring/src/index';

describe('versioned scoring', () => {
  it('keeps commonality in the closed range', () => {
    const population = [
      { setCount: 1, totalQuantity: 2, themeCount: 1, colorCount: 1, yearSpan: 1 },
      { setCount: 20, totalQuantity: 80, themeCount: 4, colorCount: 8, yearSpan: 12 },
    ];
    expect(commonalityScore(population[0]!, population)).toBeGreaterThanOrEqual(0);
    expect(commonalityScore(population[1]!, population)).toBeLessThanOrEqual(1);
  });

  it('does not penalize higher target quantity when other donor inputs are controlled', () => {
    const results = scoreDonorCandidates([
      { setId: 'low', targetQuantity: 2, setTotalParts: 100, reusableCommonRatio: 0.5, inventoryDiversity: 0.2 },
      { setId: 'high', targetQuantity: 8, setTotalParts: 100, reusableCommonRatio: 0.5, inventoryDiversity: 0.2 },
    ]);
    const low = results.find((item) => item.setId === 'low');
    const high = results.find((item) => item.setId === 'high');
    expect(high?.inventoryDonorScore).toBeGreaterThanOrEqual(low?.inventoryDonorScore ?? 0);
  });

  it('breaks exact score ties by stable set ID', () => {
    const results = scoreDonorCandidates([
      { setId: 'b', targetQuantity: 2, setTotalParts: 10, reusableCommonRatio: 0.5, inventoryDiversity: 0.2 },
      { setId: 'a', targetQuantity: 2, setTotalParts: 10, reusableCommonRatio: 0.5, inventoryDiversity: 0.2 },
    ]);
    expect(results.map((item) => item.setId)).toEqual(['a', 'b']);
  });
});
