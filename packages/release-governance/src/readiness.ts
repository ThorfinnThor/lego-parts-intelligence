import type { LegalReleaseConfig } from '../../data-contracts/src/index';

export type ReadinessStatus = 'pass' | 'warning' | 'blocked';

export interface ReadinessCheck {
  id: string;
  status: ReadinessStatus;
  detail: string;
}

export interface ReadinessInput {
  releaseDate: string;
  appBaseUrl?: string;
  source: {
    status: 'approved' | 'approved_with_conditions' | 'blocked';
    catalogCommercialUse: boolean;
    mocImages: false;
    displayAds: 'approved' | 'blocked_pending_terms_context' | 'blocked';
    affiliateLinks: 'approved' | 'per_program_review' | 'blocked_pending_partner_review' | 'blocked';
    reviewDueAt: string;
    productionApproval: boolean;
  };
  legal: LegalReleaseConfig;
  launch: { totalPages: number; minPages: number; targetPages: number };
  assets: { count: number; freeLimit: number };
  staticRuntime: boolean;
  requestedMonetization: { displayAds: boolean; affiliateLinks: boolean };
}

export function evaluateReleaseReadiness(input: ReadinessInput): ReadinessCheck[] {
  const sourceRightsReady = input.source.status !== 'blocked'
    && input.source.catalogCommercialUse
    && !input.source.mocImages;
  const domainReady = isProductionDomain(input.appBaseUrl);
  const sourceReviewDays = daysUntil(input.releaseDate, input.source.reviewDueAt);
  const freeUtilization = input.assets.count / input.assets.freeLimit;
  const monetizationRequested = input.requestedMonetization.displayAds || input.requestedMonetization.affiliateLinks;
  const monetizationAllowed = !monetizationRequested || (input.legal.status === 'approved'
    && (!input.requestedMonetization.displayAds || (
      input.source.displayAds === 'approved' && input.legal.commercialization.displayAds
    ))
    && (!input.requestedMonetization.affiliateLinks || (
      input.source.affiliateLinks === 'approved' && input.legal.commercialization.affiliateLinks
    )));

  const checks: ReadinessCheck[] = [
    {
      id: 'source-rights',
      status: sourceRightsReady ? 'pass' : 'blocked',
      detail: sourceRightsReady ? 'Catalogue rights gate is representable and MOC images remain blocked.' : 'Source rights configuration blocks catalogue publication.',
    },
    {
      id: 'source-production-approval',
      status: input.source.productionApproval ? 'pass' : 'blocked',
      detail: input.source.productionApproval ? 'Operator/legal source approval is recorded.' : 'productionApproval is still false.',
    },
    reviewCheck('source-review', sourceReviewDays, input.source.reviewDueAt),
    {
      id: 'legal-disclosures',
      status: input.legal.status === 'approved' ? 'pass' : 'blocked',
      detail: input.legal.status === 'approved' ? 'Operator, contact, imprint, privacy, and approval details are complete.' : 'Legal disclosure configuration is still a draft.',
    },
    ...(input.legal.status === 'approved'
      ? [reviewCheck('legal-review', daysUntil(input.releaseDate, input.legal.reviewDueAt), input.legal.reviewDueAt)]
      : []),
    {
      id: 'production-domain',
      status: domainReady ? 'pass' : 'blocked',
      detail: domainReady ? `Final canonical domain: ${input.appBaseUrl}` : 'APP_BASE_URL is missing, local, or a placeholder.',
    },
    {
      id: 'launch-cohort',
      status: input.launch.totalPages < input.launch.minPages
        ? 'blocked'
        : input.launch.totalPages < input.launch.targetPages ? 'warning' : 'pass',
      detail: `${input.launch.totalPages} selected pages; minimum ${input.launch.minPages}, target ${input.launch.targetPages}.`,
    },
    {
      id: 'cloudflare-free-assets',
      status: input.assets.count > input.assets.freeLimit
        ? 'blocked'
        : freeUtilization > 0.9 ? 'warning' : 'pass',
      detail: `${input.assets.count}/${input.assets.freeLimit} files (${Math.round(freeUtilization * 10_000) / 100}% of the free ceiling).`,
    },
    {
      id: 'static-runtime',
      status: input.staticRuntime ? 'pass' : 'blocked',
      detail: input.staticRuntime ? 'Public catalogue uses direct static assets with zero Worker runtime invocations.' : 'A Worker entry point or asset binding was detected.',
    },
    {
      id: 'monetization-gates',
      status: monetizationAllowed ? 'pass' : 'blocked',
      detail: monetizationRequested
        ? 'Requested monetization must be approved by both source and legal configuration.'
        : 'Ads and affiliate links remain safely disabled.',
    },
  ];

  return checks;
}

export function readinessIsLaunchable(checks: ReadinessCheck[]): boolean {
  return checks.every((check) => check.status !== 'blocked');
}

function isProductionDomain(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname !== 'example.com'
      && url.hostname !== 'localhost'
      && url.pathname === '/'
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function daysUntil(fromDate: string, dueDate: string): number {
  const milliseconds = Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`);
  return Math.floor(milliseconds / 86_400_000);
}

function reviewCheck(id: string, daysRemaining: number, dueDate: string): ReadinessCheck {
  return {
    id,
    status: daysRemaining < 0 ? 'blocked' : daysRemaining <= 30 ? 'warning' : 'pass',
    detail: daysRemaining < 0
      ? `Review expired on ${dueDate}.`
      : `Review due ${dueDate} (${daysRemaining} days remaining).`,
  };
}
