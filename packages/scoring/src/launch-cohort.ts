import { clamp01, roundScore } from './index';

export const LAUNCH_PAGE_TYPES = [
  'part',
  'donor',
  'relationship',
  'set_support',
  'minifig',
  'ranking_or_methodology',
] as const;

export type LaunchPageType = typeof LAUNCH_PAGE_TYPES[number];

export interface LaunchPriorityComponents {
  relationshipDepth: number;
  occurrenceDepth: number;
  derivedInsightCount: number;
  internalLinkValue: number;
  metadataCompleteness: number;
}

export interface LaunchCandidate {
  pageType: LaunchPageType;
  route: string;
  qualified: boolean;
  hardBlockReasons: string[];
  components: LaunchPriorityComponents;
}

export interface LaunchCohortConfig {
  version: string;
  minPages: number;
  targetPages: number;
  maxPages: number;
  pageTypeTargets: Record<LaunchPageType, number>;
}

export interface ScoredLaunchCandidate extends LaunchCandidate {
  launchPriorityScore: number;
  pageTypeDiversityBonus: number;
}

export interface LaunchCohortResult {
  selected: ScoredLaunchCandidate[];
  excluded: Array<ScoredLaunchCandidate & { exclusionReason: 'hard_block' | 'capacity' }>;
  byType: Record<LaunchPageType, { available: number; target: number; selected: number; shortfall: number }>;
  launchReady: boolean;
}

export function selectLaunchCohort(
  candidates: readonly LaunchCandidate[],
  config: LaunchCohortConfig,
): LaunchCohortResult {
  validateConfig(config);
  const routes = new Set<string>();
  for (const candidate of candidates) {
    if (routes.has(candidate.route)) throw new Error(`Duplicate launch candidate route: ${candidate.route}`);
    routes.add(candidate.route);
    validateCandidate(candidate);
  }

  const qualified = candidates.filter((candidate) => candidate.qualified && candidate.hardBlockReasons.length === 0);
  const totalQualified = qualified.length;
  const maxTypeTarget = Math.max(...LAUNCH_PAGE_TYPES.map((type) => config.pageTypeTargets[type]), 1);
  const scored = candidates.map((candidate) => {
    const availableForType = qualified.filter((item) => item.pageType === candidate.pageType).length;
    const desiredShare = config.pageTypeTargets[candidate.pageType] / Math.max(config.targetPages, 1);
    const availableShare = availableForType / Math.max(totalQualified, 1);
    const quotaWeight = config.pageTypeTargets[candidate.pageType] / maxTypeTarget;
    const pageTypeDiversityBonus = availableShare > 0
      ? clamp01(desiredShare / availableShare)
      : clamp01(quotaWeight);
    return {
      ...candidate,
      pageTypeDiversityBonus: roundScore(pageTypeDiversityBonus),
      launchPriorityScore: scoreLaunchPriority(candidate.components, pageTypeDiversityBonus),
    };
  });

  const qualifiedScored = scored
    .filter((candidate) => candidate.qualified && candidate.hardBlockReasons.length === 0)
    .sort(compareCandidates);
  const selectedRoutes = new Set<string>();
  const selected: ScoredLaunchCandidate[] = [];

  for (const pageType of LAUNCH_PAGE_TYPES) {
    const quota = config.pageTypeTargets[pageType];
    for (const candidate of qualifiedScored.filter((item) => item.pageType === pageType).slice(0, quota)) {
      selected.push(candidate);
      selectedRoutes.add(candidate.route);
    }
  }

  for (const candidate of qualifiedScored) {
    if (selected.length >= config.targetPages || selected.length >= config.maxPages) break;
    if (!selectedRoutes.has(candidate.route)) {
      selected.push(candidate);
      selectedRoutes.add(candidate.route);
    }
  }
  selected.sort((left, right) => left.pageType.localeCompare(right.pageType) || compareCandidates(left, right));

  const excluded = scored
    .filter((candidate) => !selectedRoutes.has(candidate.route))
    .map((candidate) => ({
      ...candidate,
      exclusionReason: candidate.qualified && candidate.hardBlockReasons.length === 0
        ? 'capacity' as const
        : 'hard_block' as const,
    }))
    .sort((left, right) => left.pageType.localeCompare(right.pageType) || compareCandidates(left, right));

  const byType = Object.fromEntries(LAUNCH_PAGE_TYPES.map((pageType) => {
    const available = qualifiedScored.filter((candidate) => candidate.pageType === pageType).length;
    const selectedCount = selected.filter((candidate) => candidate.pageType === pageType).length;
    const target = config.pageTypeTargets[pageType];
    return [pageType, { available, target, selected: selectedCount, shortfall: Math.max(0, target - selectedCount) }];
  })) as LaunchCohortResult['byType'];

  return {
    selected,
    excluded,
    byType,
    launchReady: selected.length >= config.minPages && selected.length <= config.maxPages,
  };
}

export function scoreLaunchPriority(
  components: LaunchPriorityComponents,
  pageTypeDiversityBonus: number,
): number {
  return roundScore(
    0.3 * components.relationshipDepth
    + 0.25 * components.occurrenceDepth
    + 0.15 * components.derivedInsightCount
    + 0.15 * components.internalLinkValue
    + 0.1 * components.metadataCompleteness
    + 0.05 * clamp01(pageTypeDiversityBonus),
  );
}

function compareCandidates(left: ScoredLaunchCandidate, right: ScoredLaunchCandidate): number {
  return right.launchPriorityScore - left.launchPriorityScore || left.route.localeCompare(right.route);
}

function validateCandidate(candidate: LaunchCandidate): void {
  if (!candidate.route.startsWith('/') || !candidate.route.endsWith('/')) {
    throw new Error(`Launch candidate route must be canonical and trailing-slashed: ${candidate.route}`);
  }
  for (const [name, value] of Object.entries(candidate.components)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Launch priority component ${name} is outside [0,1] for ${candidate.route}.`);
    }
  }
  if (!candidate.qualified && candidate.hardBlockReasons.length === 0) {
    throw new Error(`Unqualified launch candidate lacks a hard-block reason: ${candidate.route}`);
  }
}

function validateConfig(config: LaunchCohortConfig): void {
  const integers = [config.minPages, config.targetPages, config.maxPages, ...Object.values(config.pageTypeTargets)];
  if (integers.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Launch cohort limits and targets must be non-negative integers.');
  }
  if (config.minPages > config.targetPages || config.targetPages > config.maxPages) {
    throw new Error('Launch cohort requires minPages <= targetPages <= maxPages.');
  }
  const quotaTotal = Object.values(config.pageTypeTargets).reduce((sum, value) => sum + value, 0);
  if (quotaTotal > config.maxPages) throw new Error('Launch page-type targets exceed maxPages.');
}
