import { describe, expect, it } from 'vitest';
import { dataSourceConfigSchema } from '../../packages/data-contracts/src/index';

const valid = {
  source: 'rebrickable',
  status: 'approved_with_conditions',
  catalogCommercialUse: true,
  bulkDownloads: true,
  externalSetPartMinifigImages: true,
  mocImages: false,
  attributionText: 'Data sourced from Rebrickable.',
  displayAds: 'blocked_pending_terms_context',
  affiliateLinks: 'blocked_pending_partner_review',
  reviewedAt: '2026-08-16',
  reviewDueAt: '2026-11-16',
  productionApproval: false,
} as const;

describe('source rights gate', () => {
  it('accepts the documented safe-default source state', () => {
    expect(dataSourceConfigSchema.parse(valid).mocImages).toBe(false);
  });

  it('cannot represent MOC images as exportable', () => {
    expect(() => dataSourceConfigSchema.parse({ ...valid, mocImages: true })).toThrow();
  });
});
