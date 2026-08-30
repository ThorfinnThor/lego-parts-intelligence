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
  const transformed = population.map((item) => Math.log1p(Math.max(0, item)));
  const min = Math.min(...transformed);
  const max = Math.max(...transformed);
  if (max === min) return value > 0 ? 1 : 0;
  return roundScore((Math.log1p(Math.max(0, value)) - min) / (max - min));
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
  const score =
    0.45 * logNormalize(input.setCount, population.map((item) => item.setCount)) +
    0.2 * logNormalize(input.totalQuantity, population.map((item) => item.totalQuantity)) +
    0.15 * logNormalize(input.themeCount, population.map((item) => item.themeCount)) +
    0.1 * logNormalize(input.colorCount, population.map((item) => item.colorCount)) +
    0.1 * logNormalize(input.yearSpan, population.map((item) => item.yearSpan));
  return roundScore(score);
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
