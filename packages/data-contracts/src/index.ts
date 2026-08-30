import { z } from 'zod';

export const sourceStatusSchema = z.enum(['approved', 'approved_with_conditions', 'blocked']);

export const dataSourceConfigSchema = z.object({
  source: z.literal('rebrickable'),
  status: sourceStatusSchema,
  catalogCommercialUse: z.boolean(),
  bulkDownloads: z.boolean(),
  externalSetPartMinifigImages: z.boolean(),
  mocImages: z.literal(false),
  attributionText: z.string().min(1),
  displayAds: z.enum(['approved', 'blocked_pending_terms_context', 'blocked']),
  affiliateLinks: z.enum(['approved', 'per_program_review', 'blocked_pending_partner_review', 'blocked']),
  reviewedAt: z.iso.date(),
  reviewDueAt: z.iso.date(),
  productionApproval: z.boolean(),
});

export const publicPartDetailSchema = z.object({
  schemaVersion: z.literal(1),
  exportVersion: z.string().min(1),
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.object({ id: z.string(), name: z.string(), slug: z.string() }).optional(),
  image: z.object({ url: z.url(), source: z.literal('rebrickable') }).optional(),
  years: z.object({ first: z.number().int().optional(), last: z.number().int().optional() }),
  statistics: z.object({
    setCount: z.number().int().nonnegative(),
    themeCount: z.number().int().nonnegative(),
    colorCount: z.number().int().nonnegative(),
    totalQuantity: z.number().int().nonnegative(),
    commonalityScore: z.number().min(0).max(1).optional(),
    rarityScore: z.number().min(0).max(1).optional(),
  }),
  topColors: z.array(z.object({
    id: z.string(),
    name: z.string(),
    rgb: z.string().optional(),
    setCount: z.number().int().nonnegative(),
    totalQuantity: z.number().int().nonnegative(),
  })),
  topSets: z.array(z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    year: z.number().int().optional(),
    quantity: z.number().int().nonnegative(),
  })),
  relationships: z.array(z.object({
    type: z.string(),
    targetPartId: z.string(),
    targetSlug: z.string(),
    targetName: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  })),
  indexable: z.boolean(),
  updatedAt: z.string(),
});

export const publicDonorSetSchema = z.object({
  schemaVersion: z.literal(1),
  exportVersion: z.string(),
  partId: z.string(),
  partSlug: z.string(),
  partName: z.string(),
  methodologyVersion: z.literal('donor-v1'),
  indexable: z.boolean(),
  candidates: z.array(z.object({
    setId: z.string(),
    setSlug: z.string(),
    setName: z.string(),
    year: z.number().int().optional(),
    targetQuantity: z.number().int().nonnegative(),
    setTotalParts: z.number().int().positive(),
    partDensity: z.number().min(0).max(1),
    reusableCommonRatio: z.number().min(0).max(1),
    inventoryDiversity: z.number().min(0).max(1),
    inventoryDonorScore: z.number().min(0).max(1),
  })),
});

export type PublicPartDetailV1 = z.infer<typeof publicPartDetailSchema>;
export type PublicDonorSetV1 = z.infer<typeof publicDonorSetSchema>;

export interface PublicSetDetailV1 {
  schemaVersion: 1;
  exportVersion: string;
  id: string;
  slug: string;
  name: string;
  year?: number;
  theme?: string;
  totalParts: number;
  parts: Array<{ id: string; slug: string; name: string; quantity: number }>;
  updatedAt: string;
}

export interface SearchDocumentV1 {
  id: string;
  slug: string;
  type: 'part' | 'set';
  name: string;
  number: string;
  category?: string;
  theme?: string;
  year?: number;
  score?: number;
}

export interface PublicManifestV1 {
  schemaVersion: 1;
  exportVersion: string;
  source: 'rebrickable';
  sourceSnapshot: string;
  generatedAt: string;
  methodologies: {
    partStatistics: 'part-stats-v1';
    donorScore: 'donor-v1';
    indexability: 'indexability-v1';
  };
  counts: {
    parts: number;
    sets: number;
    partPages: number;
    donorPages: number;
    relationshipPages: number;
    rankings: number;
  };
  routes: {
    parts: string[];
    donors: string[];
    relationships: string[];
    sets: string[];
    rankings: string[];
  };
  searchIndexes: string[];
  checksums: Record<string, string>;
}

export interface CanonicalColor {
  id: string;
  name: string;
  rgb?: string;
  isTransparent: boolean;
}

export interface CanonicalPart {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  imageUrl?: string;
}

export interface CanonicalSet {
  id: string;
  name: string;
  slug: string;
  year: number;
  themeId: string;
  declaredPartCount: number;
  imageUrl?: string;
}

export interface CanonicalInventoryPart {
  inventoryId: string;
  partId: string;
  colorId: string;
  quantity: number;
  isSpare: boolean;
}
