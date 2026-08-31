import { describe, expect, it } from 'vitest';
import { dataSourceConfigSchema, legalReleaseConfigSchema } from '../../packages/data-contracts/src/index';
import { assertReleaseGates, selectCatalogImage } from '../../packages/exporter/src/build-release';

const valid = {
  source: 'rebrickable',
  status: 'approved_with_conditions',
  catalogCommercialUse: true,
  bulkDownloads: true,
  externalSetPartMinifigImages: false,
  mocImages: false,
  attributionText: 'Data sourced from Rebrickable.',
  displayAds: 'blocked',
  affiliateLinks: 'blocked',
  reviewedAt: '2026-08-31',
  reviewDueAt: '2026-11-30',
  productionApproval: false,
} as const;

describe('source rights gate', () => {
  it('accepts the documented safe-default source state', () => {
    expect(dataSourceConfigSchema.parse(valid).mocImages).toBe(false);
  });

  it('cannot represent MOC images as exportable', () => {
    expect(() => dataSourceConfigSchema.parse({ ...valid, mocImages: true })).toThrow();
  });

  it('strips catalogue images when external image rights are disabled', () => {
    expect(selectCatalogImage('https://cdn.rebrickable.com/media/parts/example.png', false)).toBeUndefined();
  });

  it('retains an allowed catalogue image only when the image gate is enabled', () => {
    const url = 'https://cdn.rebrickable.com/media/parts/example.png';
    expect(selectCatalogImage(url, true)).toBe(url);
  });

  it('rejects MOC images even when the image gate is enabled', () => {
    expect(() => selectCatalogImage('https://cdn.rebrickable.com/media/mocs/example.png', true)).toThrow(/MOC images/);
  });
});

describe('legal release gate', () => {
  it('accepts only a non-commercial draft while approval is pending', () => {
    const draft = legalReleaseConfigSchema.parse({
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
    });
    expect(draft.status).toBe('draft');
  });

  it('rejects an approved release without complete operator disclosures', () => {
    expect(() => legalReleaseConfigSchema.parse({
      status: 'approved',
      operatorName: '',
      contactEmail: 'invalid',
      imprintUrl: null,
      privacyUrl: null,
      trademarkNotice: 'Independent project trademark notice.',
      reviewedAt: '2026-08-31',
      reviewDueAt: '2026-11-30',
      approvedBy: '',
      commercialization: { displayAds: false, affiliateLinks: false },
    })).toThrow();
  });

  it('blocks production while the legal disclosure remains a valid draft', () => {
    const source = dataSourceConfigSchema.parse({ ...valid, productionApproval: true });
    const draft = legalReleaseConfigSchema.parse({
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
    });

    expect(() => assertReleaseGates(source, draft, true, '2026-08-31')).toThrow(/legal-release status is not approved/);
    expect(() => assertReleaseGates(source, draft, false, '2026-08-31')).not.toThrow();
  });

  it('blocks production when an approval review is overdue', () => {
    const source = dataSourceConfigSchema.parse({ ...valid, productionApproval: true });
    const approved = legalReleaseConfigSchema.parse({
      status: 'approved',
      operatorName: 'Example Operator',
      contactEmail: 'operator@example.org',
      imprintUrl: 'https://parts.example.org/imprint/',
      privacyUrl: 'https://parts.example.org/privacy/',
      trademarkNotice: 'Independent project trademark notice.',
      reviewedAt: '2026-08-01',
      reviewDueAt: '2026-08-30',
      approvedBy: 'Legal owner',
      commercialization: { displayAds: false, affiliateLinks: false },
    });

    expect(() => assertReleaseGates(source, approved, true, '2026-08-31')).toThrow(/review is overdue/);
  });
});
