import { describe, expect, it } from 'vitest';
import { evaluateReleaseReadiness, readinessIsLaunchable, type ReadinessInput } from '../../packages/release-governance/src/readiness';

const readyInput: ReadinessInput = {
  releaseDate: '2026-08-31',
  appBaseUrl: 'https://parts.example.org/',
  source: {
    status: 'approved',
    catalogCommercialUse: true,
    externalSetPartMinifigImages: true,
    mocImages: false,
    displayAds: 'approved',
    affiliateLinks: 'approved',
    reviewDueAt: '2026-12-31',
    productionApproval: true,
  },
  legal: {
    status: 'approved',
    operatorName: 'Example Operator',
    contactEmail: 'operator@example.org',
    imprintUrl: 'https://parts.example.org/imprint/',
    privacyUrl: 'https://parts.example.org/privacy/',
    trademarkNotice: 'Independent project trademark notice.',
    reviewedAt: '2026-08-01',
    reviewDueAt: '2026-12-31',
    approvedBy: 'Legal owner',
    commercialization: { displayAds: false, affiliateLinks: false },
  },
  launch: { totalPages: 500, minPages: 250, targetPages: 500 },
  assets: { count: 9_000, freeLimit: 20_000 },
  staticRuntime: true,
  requestedMonetization: { displayAds: false, affiliateLinks: false },
};

describe('release readiness', () => {
  it('is launchable only when no blocking gate remains', () => {
    const checks = evaluateReleaseReadiness(readyInput);
    expect(readinessIsLaunchable(checks)).toBe(true);
  });

  it('reports the fixture-sized launch and missing canonical domain as blockers', () => {
    const checks = evaluateReleaseReadiness({
      ...readyInput,
      appBaseUrl: 'https://example.com',
      launch: { totalPages: 23, minPages: 250, targetPages: 500 },
    });
    expect(checks.find((check) => check.id === 'production-domain')?.status).toBe('blocked');
    expect(checks.find((check) => check.id === 'launch-cohort')?.status).toBe('blocked');
    expect(readinessIsLaunchable(checks)).toBe(false);
  });

  it('warns before the free asset ceiling is exhausted', () => {
    const checks = evaluateReleaseReadiness({
      ...readyInput,
      assets: { count: 18_500, freeLimit: 20_000 },
    });
    expect(checks.find((check) => check.id === 'cloudflare-free-assets')?.status).toBe('warning');
  });

  it('treats disabled monetization as the safe default while legal review is pending', () => {
    const checks = evaluateReleaseReadiness({
      ...readyInput,
      legal: {
        status: 'draft',
        operatorName: null,
        contactEmail: null,
        imprintUrl: null,
        privacyUrl: null,
        trademarkNotice: 'Independent project trademark notice.',
        reviewedAt: null,
        reviewDueAt: null,
        approvedBy: null,
        commercialization: { displayAds: false, affiliateLinks: false },
      },
    });
    expect(checks.find((check) => check.id === 'monetization-gates')?.status).toBe('pass');
  });

  it('reports that disabled catalogue images are stripped by the exporter', () => {
    const checks = evaluateReleaseReadiness({
      ...readyInput,
      source: { ...readyInput.source, externalSetPartMinifigImages: false },
    });
    expect(checks.find((check) => check.id === 'catalogue-images')).toMatchObject({
      status: 'pass',
      detail: 'Catalogue images are disabled; the exporter strips every source image URL.',
    });
  });
});
