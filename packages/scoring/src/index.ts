export const METHODOLOGIES = {
  partStatistics: 'part-stats-v1',
  donor: 'donor-v1',
  indexability: 'indexability-v1',
} as const;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp01(value) * 10_000) / 10_000;
}

export function logNormalize(value: number, population: readonly number[]): number {
  if (population.length === 0) return 0;
  return createLogNormalizer(population)(value);
}

export function createLogNormalizer(population: readonly number[]): (value: number) => number {
  const range = logRange(population);
  return (value) => normalizeWithRange(value, range);
}

function logRange(population: readonly number[]): { min: number; max: number } {
  if (population.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const item of population) {
    const transformed = Math.log1p(Math.max(0, item));
    if (transformed < min) min = transformed;
    if (transformed > max) max = transformed;
  }
  return { min, max };
}

function normalizeWithRange(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) return value > 0 ? 1 : 0;
  return roundScore((Math.log1p(Math.max(0, value)) - range.min) / (range.max - range.min));
}

export interface CommonalityInputs {
  setCount: number;
  totalQuantity: number;
  themeCount: number;
  colorCount: number;
  yearSpan: number;
}

export function commonalityScore(
  input: CommonalityInputs,
  population: readonly CommonalityInputs[],
): number {
  return createCommonalityScorer(population)(input);
}

export function createCommonalityScorer(
  population: readonly CommonalityInputs[],
): (input: CommonalityInputs) => number {
  const ranges = {
    setCount: logRange(population.map((item) => item.setCount)),
    totalQuantity: logRange(population.map((item) => item.totalQuantity)),
    themeCount: logRange(population.map((item) => item.themeCount)),
    colorCount: logRange(population.map((item) => item.colorCount)),
    yearSpan: logRange(population.map((item) => item.yearSpan)),
  };
  return (input) => {
  const score =
    0.45 * normalizeWithRange(input.setCount, ranges.setCount) +
    0.2 * normalizeWithRange(input.totalQuantity, ranges.totalQuantity) +
    0.15 * normalizeWithRange(input.themeCount, ranges.themeCount) +
    0.1 * normalizeWithRange(input.colorCount, ranges.colorCount) +
    0.1 * normalizeWithRange(input.yearSpan, ranges.yearSpan);
    return roundScore(score);
  };
}

export interface DonorCandidateInputs {
  setId: string;
  targetQuantity: number;
  setTotalParts: number;
  reusableCommonRatio: number;
  inventoryDiversity: number;
}

export interface DonorCandidateScore extends DonorCandidateInputs {
  partDensity: number;
  inventoryDonorScore: number;
}

export function scoreDonorCandidates(
  candidates: readonly DonorCandidateInputs[],
): DonorCandidateScore[] {
  const quantities = candidates.map((item) => item.targetQuantity);
  const densities = candidates.map((item) => item.targetQuantity / Math.max(item.setTotalParts, 1));
  const commonRatios = candidates.map((item) => item.reusableCommonRatio);
  const diversities = candidates.map((item) => item.inventoryDiversity);

  return candidates
    .map((candidate, index) => {
      const partDensity = densities[index] ?? 0;
      const score =
        0.6 * logNormalize(candidate.targetQuantity, quantities) +
        0.2 * logNormalize(partDensity, densities) +
        0.1 * logNormalize(candidate.reusableCommonRatio, commonRatios) +
        0.1 * logNormalize(candidate.inventoryDiversity, diversities);
      return {
        ...candidate,
        partDensity: roundScore(partDensity),
        inventoryDonorScore: roundScore(score),
      };
    })
    .sort((left, right) =>
      right.inventoryDonorScore - left.inventoryDonorScore ||
      right.targetQuantity - left.targetQuantity ||
      left.setId.localeCompare(right.setId),
    );
}
