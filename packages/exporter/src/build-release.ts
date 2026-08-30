import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  dataSourceConfigSchema,
  publicDonorSetSchema,
  publicPartDetailSchema,
  type CanonicalColor,
  type CanonicalInventoryPart,
  type CanonicalPart,
  type CanonicalSet,
  type PublicDonorSetV1,
  type PublicManifestV1,
  type PublicPartDetailV1,
  type PublicSetDetailV1,
  type SearchDocumentV1,
} from '../../data-contracts/src/index';
import { createStableSlug, shardPrefix } from '../../normalization/src/index';
import { clamp01, commonalityScore, logNormalize, roundScore, scoreDonorCandidates } from '../../scoring/src/index';
import {
  LAUNCH_PAGE_TYPES,
  selectLaunchCohort,
  type LaunchCandidate,
  type LaunchCohortConfig,
  type LaunchCohortResult,
  type LaunchPageType,
} from '../../scoring/src/launch-cohort';
import {
  assertSnapshotDirectory,
  readSnapshotCsv,
  readSnapshotLabel,
  type SourceCsvRow,
} from '../../rebrickable/src/snapshot';
import { stableJson } from './stable-json';

interface Category { id: string; name: string; slug: string }
interface Theme { id: string; name: string }
interface Inventory { id: string; setId: string }
interface Relationship { type: string; sourcePartId: string; targetPartId: string }
interface PartStats {
  setCount: number;
  themeCount: number;
  colorCount: number;
  totalQuantity: number;
  firstYear?: number;
  lastYear?: number;
  yearSpan: number;
  commonalityScore: number;
  rarityScore: number;
}
type CsvRow = SourceCsvRow;

const RELATIONSHIP_TYPES: Record<string, string> = {
  A: 'alternate',
  M: 'mold_variant',
  P: 'print_variant',
  R: 'replacement',
};

const FIXTURE_TIMESTAMP = '2026-08-16T02:17:00.000Z';

export interface ReleaseSummary {
  exportVersion: string;
  parts: number;
  sets: number;
  indexablePages: number;
  donorPages: number;
  files: number;
}

export async function buildRelease(rootDir: string): Promise<ReleaseSummary> {
  const sourceDir = process.env.SOURCE_SNAPSHOT_DIR
    ? path.resolve(rootDir, process.env.SOURCE_SNAPSHOT_DIR)
    : path.join(rootDir, 'data', 'fixtures');
  const outputDir = path.join(rootDir, 'public', 'data');
  const sourceConfig = dataSourceConfigSchema.parse(
    JSON.parse(await readFile(path.join(rootDir, 'config', 'data-sources.json'), 'utf8')),
  );
  enforceSourceGate(sourceConfig);
  await assertSnapshotDirectory(sourceDir);
  const sourceSnapshot = await readSnapshotLabel(sourceDir);

  const [colorRows, categoryRows, themeRows, partRows, setRows, inventoryRows, inventoryPartRows, relationshipRows] =
    await Promise.all([
      readSnapshotCsv(sourceDir, 'colors.csv'),
      readSnapshotCsv(sourceDir, 'part_categories.csv'),
      readSnapshotCsv(sourceDir, 'themes.csv'),
      readSnapshotCsv(sourceDir, 'parts.csv'),
      readSnapshotCsv(sourceDir, 'sets.csv'),
      readSnapshotCsv(sourceDir, 'inventories.csv'),
      readSnapshotCsv(sourceDir, 'inventory_parts.csv'),
      readSnapshotCsv(sourceDir, 'part_relationships.csv'),
    ]);

  assertUnique(colorRows, 'id', 'colors');
  assertUnique(partRows, 'part_num', 'parts');
  assertUnique(setRows, 'set_num', 'sets');
  assertUnique(inventoryRows, 'id', 'inventories');

  const colors: CanonicalColor[] = colorRows.map((row) => ({
    id: required(row, 'id'),
    name: required(row, 'name'),
    ...(optional(row, 'rgb') ? { rgb: optional(row, 'rgb') } : {}),
    isTransparent: parseBoolean(required(row, 'is_trans')),
  }));
  const categories: Category[] = categoryRows.map((row) => {
    const id = required(row, 'id');
    const name = required(row, 'name');
    return { id, name, slug: createStableSlug(id, name) };
  });
  const themes: Theme[] = themeRows.map((row) => ({ id: required(row, 'id'), name: required(row, 'name') }));
  const parts: CanonicalPart[] = partRows.map((row) => {
    const id = required(row, 'part_num');
    const name = required(row, 'name');
    const imageUrl = optional(row, 'part_img_url');
    assertAllowedImage(imageUrl);
    return {
      id,
      name,
      slug: createStableSlug(id, name),
      categoryId: required(row, 'part_cat_id'),
      ...(imageUrl ? { imageUrl } : {}),
    };
  });
  const sets: CanonicalSet[] = setRows.map((row) => {
    const id = required(row, 'set_num');
    const name = required(row, 'name');
    const imageUrl = optional(row, 'set_img_url');
    assertAllowedImage(imageUrl);
    return {
      id,
      name,
      slug: createStableSlug(id, name),
      year: parseInteger(required(row, 'year'), 'year'),
      themeId: required(row, 'theme_id'),
      declaredPartCount: parseInteger(required(row, 'num_parts'), 'num_parts'),
      ...(imageUrl ? { imageUrl } : {}),
    };
  });
  const inventories: Inventory[] = inventoryRows.map((row) => ({
    id: required(row, 'id'),
    setId: required(row, 'set_num'),
  }));
  const inventoryParts: CanonicalInventoryPart[] = inventoryPartRows.map((row) => ({
    inventoryId: required(row, 'inventory_id'),
    partId: required(row, 'part_num'),
    colorId: required(row, 'color_id'),
    quantity: parseInteger(required(row, 'quantity'), 'quantity'),
    isSpare: parseBoolean(required(row, 'is_spare')),
  }));
  const relationships: Relationship[] = relationshipRows.map((row) => ({
    type: RELATIONSHIP_TYPES[required(row, 'rel_type')] ?? 'unknown',
    sourcePartId: required(row, 'child_part_num'),
    targetPartId: required(row, 'parent_part_num'),
  }));

  validateReferences({ colors, categories, themes, parts, sets, inventories, inventoryParts, relationships });
  const exportVersion = process.env.RELEASE_TIMESTAMP ?? FIXTURE_TIMESTAMP;
  const stats = derivePartStats(parts, sets, inventories, inventoryParts);
  const allPublicParts = buildPublicParts({
    exportVersion,
    parts,
    categories,
    colors,
    sets,
    inventories,
    inventoryParts,
    relationships,
    stats,
  });
  const allDonorPages = buildDonorPages({ exportVersion, parts, sets, inventories, inventoryParts, stats });
  const allPublicSets = buildPublicSets({ exportVersion, sets, themes, parts, inventories, inventoryParts });
  const allRankings = buildRankings(exportVersion, allPublicParts);
  const cohortConfig = parseLaunchCohortConfig(
    JSON.parse(await readFile(path.join(rootDir, 'config', 'launch-cohort.json'), 'utf8')),
  );
  const cohort = selectLaunchCohort(
    buildLaunchCandidates(allPublicParts, allDonorPages, allPublicSets, allRankings, cohortConfig),
    cohortConfig,
  );
  await writeLaunchArtifacts(rootDir, exportVersion, sourceSnapshot, cohortConfig, cohort);
  if (process.env.PRODUCTION_RELEASE === '1' && !cohort.launchReady) {
    throw new Error(`Production launch blocked: only ${cohort.selected.length} qualified pages; ${cohortConfig.minPages} required. Coverage report written to artifacts/launch-cohort/.`);
  }

  const selectedRoutes = new Set(cohort.selected.map((candidate) => candidate.route));
  const selectedPartPageSlugs = new Set(
    cohort.selected.filter((candidate) => candidate.pageType === 'part').map((candidate) => routeEntitySlug(candidate.route, 'parts')),
  );
  const selectedRelationshipSlugs = new Set(
    cohort.selected.filter((candidate) => candidate.pageType === 'relationship').map((candidate) => routeEntitySlug(candidate.route, 'parts')),
  );
  const publicParts = allPublicParts
    .filter((part) => selectedPartPageSlugs.has(part.slug) || selectedRelationshipSlugs.has(part.slug))
    .map((part) => ({ ...part, indexable: selectedPartPageSlugs.has(part.slug) }));
  const donorPages = allDonorPages
    .filter((page) => selectedRoutes.has(`/donor-sets/${page.partSlug}/`))
    .map((page) => ({ ...page, indexable: true }));
  const publicSets = allPublicSets.filter((set) => selectedRoutes.has(`/sets/${set.slug}/`));
  const rankings = allRankings
    .filter((ranking) => selectedRoutes.has(`/rankings/${ranking.slug}/`))
    .map((ranking) => ({ ...ranking, rows: ranking.rows.filter((row) => selectedPartPageSlugs.has(row.slug)) }));
  const searchDocuments = buildSearchDocuments(
    publicParts.filter((part) => selectedPartPageSlugs.has(part.slug)),
    publicSets,
  );

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const writtenFiles: string[] = [];
  for (const part of publicParts) {
    publicPartDetailSchema.parse(part);
    writtenFiles.push(await writeJson(outputDir, `parts/${shardPrefix(part.id)}/${part.id}.json`, part));
  }
  for (const donor of donorPages) {
    publicDonorSetSchema.parse(donor);
    writtenFiles.push(await writeJson(outputDir, `donor-sets/${shardPrefix(donor.partId)}/${donor.partId}.json`, donor));
  }
  for (const set of publicSets) {
    writtenFiles.push(await writeJson(outputDir, `sets/${set.id}.json`, set));
  }
  for (const ranking of rankings) {
    writtenFiles.push(await writeJson(outputDir, `rankings/${ranking.slug}.json`, ranking));
  }
  writtenFiles.push(await writeJson(outputDir, 'search-index/catalogue.json', searchDocuments));
  writtenFiles.push(await writeJson(outputDir, 'routes.json', {
    parts: Object.fromEntries(publicParts.map((part) => [part.slug, { id: part.id, shard: shardPrefix(part.id) }])),
    donors: Object.fromEntries(donorPages.map((page) => [page.partSlug, { id: page.partId, shard: shardPrefix(page.partId) }])),
    sets: Object.fromEntries(publicSets.map((set) => [set.slug, { id: set.id }])),
    rankings: Object.fromEntries(rankings.map((ranking) => [ranking.slug, { id: ranking.slug }])),
  }));

  const cohortSummary = {
    version: cohortConfig.version,
    totalPages: cohort.selected.length,
    minPages: cohortConfig.minPages,
    targetPages: cohortConfig.targetPages,
    maxPages: cohortConfig.maxPages,
    byType: Object.fromEntries(LAUNCH_PAGE_TYPES.map((type) => [type, cohort.byType[type].selected])),
    coverage: cohort.byType,
    launchReady: cohort.launchReady,
    mode: process.env.PRODUCTION_RELEASE === '1' ? 'production' : 'fixture-preview',
    sourceRelease: exportVersion,
    sourceSnapshot,
    indexabilityMethodology: 'indexability-v1',
  };
  writtenFiles.push(await writeJson(outputDir, 'cohort-summary.json', cohortSummary));
  writtenFiles.push(await writeJson(outputDir, 'launch-pages.json', cohort.selected.map((candidate) => ({
    pageType: candidate.pageType,
    route: candidate.route,
    launchPriorityScore: candidate.launchPriorityScore,
  }))));

  await writeSitemaps(rootDir, exportVersion, cohort.selected);
  const checksums = Object.fromEntries(
    await Promise.all(writtenFiles.sort().map(async (relative) => [relative, await checksum(path.join(outputDir, relative))])),
  );
  const manifest: PublicManifestV1 = {
    schemaVersion: 1,
    exportVersion,
    source: 'rebrickable',
    sourceSnapshot,
    generatedAt: exportVersion,
    methodologies: {
      partStatistics: 'part-stats-v1',
      donorScore: 'donor-v1',
      indexability: 'indexability-v1',
    },
    counts: {
      parts: allPublicParts.length,
      sets: allPublicSets.length,
      partPages: selectedPartPageSlugs.size,
      donorPages: donorPages.length,
      relationshipPages: selectedRelationshipSlugs.size,
      rankings: rankings.length,
    },
    routes: {
      parts: [...selectedPartPageSlugs].sort(),
      donors: donorPages.filter((page) => page.indexable).map((page) => page.partSlug).sort(),
      relationships: [...selectedRelationshipSlugs].sort(),
      sets: publicSets.map((set) => set.slug).sort(),
      rankings: rankings.map((ranking) => ranking.slug).sort(),
    },
    searchIndexes: ['/data/search-index/catalogue.json'],
    checksums,
  };
  await writeJson(outputDir, 'manifest.json', manifest);

  return {
    exportVersion,
    parts: allPublicParts.length,
    sets: allPublicSets.length,
    indexablePages: cohort.selected.length,
    donorPages: manifest.counts.donorPages,
    files: (await listFiles(outputDir)).length,
  };
}

/** Backwards-compatible fixture entry point used by local tests and previews. */
export const buildFixtureRelease = buildRelease;

function enforceSourceGate(config: ReturnType<typeof dataSourceConfigSchema.parse>): void {
  if (config.status === 'blocked' || !config.catalogCommercialUse || config.mocImages) {
    throw new Error('Source rights gate blocked this export.');
  }
  if (process.env.PRODUCTION_RELEASE === '1' && !config.productionApproval) {
    throw new Error('Production release blocked: operator/legal productionApproval is false.');
  }
}

function required(row: CsvRow, key: string): string {
  const value = row[key]?.trim();
  if (!value) throw new Error(`Missing required CSV value: ${key}`);
  return value;
}

function optional(row: CsvRow, key: string): string | undefined {
  const value = row[key]?.trim();
  return value || undefined;
}

function parseInteger(value: string, field: string): number {
  if (!/^-?\d+$/.test(value)) throw new Error(`Invalid integer for ${field}: ${value}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid non-negative integer for ${field}: ${value}`);
  return parsed;
}

function parseBoolean(value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid boolean: ${value}`);
}

function assertUnique(rows: CsvRow[], key: string, label: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = required(row, key);
    if (seen.has(value)) throw new Error(`Duplicate ${label} source ID: ${value}`);
    seen.add(value);
  }
}

function assertAllowedImage(url: string | undefined): void {
  if (!url) return;
  try {
    if (/(?:^|\/)mocs?(?:\/|$)/i.test(new URL(url).pathname)) {
      throw new Error(`MOC images are never exportable: ${url}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MOC images are never exportable:')) throw error;
    throw new Error(`Invalid image URL in source snapshot: ${url}`);
  }
}

function validateReferences(input: {
  colors: CanonicalColor[]; categories: Category[]; themes: Theme[]; parts: CanonicalPart[];
  sets: CanonicalSet[]; inventories: Inventory[]; inventoryParts: CanonicalInventoryPart[];
  relationships: Relationship[];
}): void {
  const colorIds = new Set(input.colors.map((item) => item.id));
  const categoryIds = new Set(input.categories.map((item) => item.id));
  const themeIds = new Set(input.themes.map((item) => item.id));
  const partIds = new Set(input.parts.map((item) => item.id));
  const setIds = new Set(input.sets.map((item) => item.id));
  const inventoryIds = new Set(input.inventories.map((item) => item.id));
  for (const part of input.parts) if (!categoryIds.has(part.categoryId)) throw new Error(`Broken category FK: ${part.id}`);
  for (const set of input.sets) if (!themeIds.has(set.themeId)) throw new Error(`Broken theme FK: ${set.id}`);
  for (const inventory of input.inventories) if (!setIds.has(inventory.setId)) throw new Error(`Broken set FK: ${inventory.id}`);
  for (const row of input.inventoryParts) {
    if (!inventoryIds.has(row.inventoryId) || !partIds.has(row.partId) || !colorIds.has(row.colorId)) {
      throw new Error(`Broken inventory part FK: ${row.inventoryId}/${row.partId}/${row.colorId}`);
    }
  }
  for (const relation of input.relationships) {
    if (!partIds.has(relation.sourcePartId) || !partIds.has(relation.targetPartId)) {
      throw new Error(`Broken relationship FK: ${relation.sourcePartId}/${relation.targetPartId}`);
    }
  }
}

function derivePartStats(
  parts: CanonicalPart[], sets: CanonicalSet[], inventories: Inventory[], rows: CanonicalInventoryPart[],
): Map<string, PartStats> {
  const setMap = new Map(sets.map((item) => [item.id, item]));
  const inventorySet = new Map(inventories.map((item) => [item.id, item.setId]));
  const raw = parts.map((part) => {
    const occurrences = rows.filter((row) => row.partId === part.id && !row.isSpare);
    const relevantSets = occurrences
      .map((row) => setMap.get(inventorySet.get(row.inventoryId) ?? ''))
      .filter((set): set is CanonicalSet => Boolean(set));
    const years = relevantSets.map((set) => set.year);
    const firstYear = years.length ? Math.min(...years) : undefined;
    const lastYear = years.length ? Math.max(...years) : undefined;
    return {
      id: part.id,
      setCount: new Set(relevantSets.map((set) => set.id)).size,
      themeCount: new Set(relevantSets.map((set) => set.themeId)).size,
      colorCount: new Set(occurrences.map((row) => row.colorId)).size,
      totalQuantity: occurrences.reduce((sum, row) => sum + row.quantity, 0),
      ...(firstYear === undefined ? {} : { firstYear }),
      ...(lastYear === undefined ? {} : { lastYear }),
      yearSpan: firstYear === undefined || lastYear === undefined ? 0 : lastYear - firstYear + 1,
    };
  });
  return new Map(raw.map((item) => {
    const score = commonalityScore(item, raw);
    return [item.id, { ...item, commonalityScore: score, rarityScore: roundScore(1 - score) }];
  }));
}

function buildPublicParts(input: {
  exportVersion: string; parts: CanonicalPart[]; categories: Category[]; colors: CanonicalColor[];
  sets: CanonicalSet[]; inventories: Inventory[]; inventoryParts: CanonicalInventoryPart[];
  relationships: Relationship[]; stats: Map<string, PartStats>;
}): PublicPartDetailV1[] {
  const categories = new Map(input.categories.map((item) => [item.id, item]));
  const colors = new Map(input.colors.map((item) => [item.id, item]));
  const sets = new Map(input.sets.map((item) => [item.id, item]));
  const inventorySet = new Map(input.inventories.map((item) => [item.id, item.setId]));
  const parts = new Map(input.parts.map((item) => [item.id, item]));
  return input.parts.map((part) => {
    const occurrences = input.inventoryParts.filter((row) => row.partId === part.id && !row.isSpare);
    const partStats = input.stats.get(part.id);
    if (!partStats) throw new Error(`Missing stats for ${part.id}`);
    const category = categories.get(part.categoryId);
    const colorStats = [...new Set(occurrences.map((row) => row.colorId))].map((colorId) => {
      const matching = occurrences.filter((row) => row.colorId === colorId);
      const color = colors.get(colorId);
      if (!color) throw new Error(`Missing color ${colorId}`);
      return {
        id: color.id,
        name: color.name,
        ...(color.rgb ? { rgb: color.rgb } : {}),
        setCount: new Set(matching.map((row) => inventorySet.get(row.inventoryId))).size,
        totalQuantity: matching.reduce((sum, row) => sum + row.quantity, 0),
      };
    }).sort((left, right) => right.setCount - left.setCount || left.id.localeCompare(right.id));
    const setStats = occurrences.map((row) => {
      const set = sets.get(inventorySet.get(row.inventoryId) ?? '');
      if (!set) throw new Error(`Missing set for inventory ${row.inventoryId}`);
      return { id: set.id, slug: set.slug, name: set.name, year: set.year, quantity: row.quantity };
    }).sort((left, right) => right.quantity - left.quantity || left.id.localeCompare(right.id));
    const relations = input.relationships
      .filter((row) => row.sourcePartId === part.id || (row.type === 'alternate' && row.targetPartId === part.id))
      .map((row) => {
        const targetId = row.sourcePartId === part.id ? row.targetPartId : row.sourcePartId;
        const target = parts.get(targetId);
        if (!target) throw new Error(`Missing related part ${targetId}`);
        return { type: row.type, targetPartId: target.id, targetSlug: target.slug, targetName: target.name };
      })
      .sort((left, right) => left.type.localeCompare(right.type) || left.targetPartId.localeCompare(right.targetPartId));
    const meaningfulSections = [colorStats.length > 0, setStats.length > 0, relations.length > 0, partStats.setCount > 0].filter(Boolean).length;
    return {
      schemaVersion: 1,
      exportVersion: input.exportVersion,
      id: part.id,
      slug: part.slug,
      name: part.name,
      ...(category ? { category } : {}),
      ...(part.imageUrl ? { image: { url: part.imageUrl, source: 'rebrickable' as const } } : {}),
      years: {
        ...(partStats.firstYear === undefined ? {} : { first: partStats.firstYear }),
        ...(partStats.lastYear === undefined ? {} : { last: partStats.lastYear }),
      },
      statistics: {
        setCount: partStats.setCount,
        themeCount: partStats.themeCount,
        colorCount: partStats.colorCount,
        totalQuantity: partStats.totalQuantity,
        commonalityScore: partStats.commonalityScore,
        rarityScore: partStats.rarityScore,
      },
      topColors: colorStats,
      topSets: setStats,
      relationships: relations,
      indexable: partStats.setCount >= 1 && meaningfulSections >= 2,
      updatedAt: input.exportVersion,
    } satisfies PublicPartDetailV1;
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function buildDonorPages(input: {
  exportVersion: string; parts: CanonicalPart[]; sets: CanonicalSet[]; inventories: Inventory[];
  inventoryParts: CanonicalInventoryPart[]; stats: Map<string, PartStats>;
}): PublicDonorSetV1[] {
  const setMap = new Map(input.sets.map((item) => [item.id, item]));
  const inventorySet = new Map(input.inventories.map((item) => [item.id, item.setId]));
  return input.parts.map((part) => {
    const targetRows = input.inventoryParts.filter((row) => row.partId === part.id && !row.isSpare);
    const candidateInputs = targetRows.map((target) => {
      const setId = inventorySet.get(target.inventoryId);
      if (!setId) throw new Error(`Missing inventory ${target.inventoryId}`);
      const setRows = input.inventoryParts.filter((row) => row.inventoryId === target.inventoryId && !row.isSpare);
      const total = setRows.reduce((sum, row) => sum + row.quantity, 0);
      const otherUnits = setRows.filter((row) => row.partId !== part.id);
      const commonUnits = otherUnits
        .filter((row) => (input.stats.get(row.partId)?.commonalityScore ?? 0) >= 0.5)
        .reduce((sum, row) => sum + row.quantity, 0);
      return {
        setId,
        targetQuantity: target.quantity,
        setTotalParts: Math.max(total, 1),
        reusableCommonRatio: roundScore(commonUnits / Math.max(otherUnits.reduce((sum, row) => sum + row.quantity, 0), 1)),
        inventoryDiversity: roundScore(new Set(setRows.map((row) => row.partId)).size / Math.max(total, 1)),
      };
    });
    const candidates = scoreDonorCandidates(candidateInputs).map((candidate) => {
      const set = setMap.get(candidate.setId);
      if (!set) throw new Error(`Missing set ${candidate.setId}`);
      return {
        setId: set.id,
        setSlug: set.slug,
        setName: set.name,
        year: set.year,
        targetQuantity: candidate.targetQuantity,
        setTotalParts: candidate.setTotalParts,
        partDensity: candidate.partDensity,
        reusableCommonRatio: candidate.reusableCommonRatio,
        inventoryDiversity: candidate.inventoryDiversity,
        inventoryDonorScore: candidate.inventoryDonorScore,
      };
    });
    return {
      schemaVersion: 1,
      exportVersion: input.exportVersion,
      partId: part.id,
      partSlug: part.slug,
      partName: part.name,
      methodologyVersion: 'donor-v1',
      indexable: candidates.length >= 3,
      candidates,
    } satisfies PublicDonorSetV1;
  }).sort((left, right) => left.partId.localeCompare(right.partId));
}

function buildPublicSets(input: {
  exportVersion: string; sets: CanonicalSet[]; themes: Theme[]; parts: CanonicalPart[];
  inventories: Inventory[]; inventoryParts: CanonicalInventoryPart[];
}): PublicSetDetailV1[] {
  const themes = new Map(input.themes.map((item) => [item.id, item.name]));
  const parts = new Map(input.parts.map((item) => [item.id, item]));
  return input.sets.map((set) => {
    const inventoryIds = new Set(input.inventories.filter((item) => item.setId === set.id).map((item) => item.id));
    const rows = input.inventoryParts.filter((row) => inventoryIds.has(row.inventoryId) && !row.isSpare);
    return {
      schemaVersion: 1,
      exportVersion: input.exportVersion,
      id: set.id,
      slug: set.slug,
      name: set.name,
      year: set.year,
      ...(themes.get(set.themeId) ? { theme: themes.get(set.themeId) } : {}),
      totalParts: rows.reduce((sum, row) => sum + row.quantity, 0),
      parts: rows.map((row) => {
        const part = parts.get(row.partId);
        if (!part) throw new Error(`Missing part ${row.partId}`);
        return { id: part.id, slug: part.slug, name: part.name, quantity: row.quantity };
      }).sort((left, right) => right.quantity - left.quantity || left.id.localeCompare(right.id)),
      updatedAt: input.exportVersion,
    } satisfies PublicSetDetailV1;
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function buildRankings(exportVersion: string, parts: PublicPartDetailV1[]) {
  const definition = (slug: string, title: string, description: string, rows: PublicPartDetailV1[]) => ({
    schemaVersion: 1,
    exportVersion,
    slug,
    title,
    description,
    methodologyVersion: 'part-stats-v1',
    updatedAt: exportVersion,
    rows: rows.slice(0, 50).map((part, index) => ({
      rank: index + 1,
      id: part.id,
      slug: part.slug,
      name: part.name,
      setCount: part.statistics.setCount,
      score: slug === 'catalog-rarity' ? part.statistics.rarityScore : part.statistics.commonalityScore,
    })),
  });
  return [
    definition('most-common-parts', 'Most common parts in the catalogue', 'Ranked by the versioned catalogue commonality signal.', [...parts].sort((a, b) => (b.statistics.commonalityScore ?? 0) - (a.statistics.commonalityScore ?? 0) || a.id.localeCompare(b.id))),
    definition('catalog-rarity', 'Parts with the strongest catalogue rarity signal', 'A catalogue coverage signal, not a statement about price or collector value.', [...parts].sort((a, b) => (b.statistics.rarityScore ?? 0) - (a.statistics.rarityScore ?? 0) || a.id.localeCompare(b.id))),
  ];
}

function buildSearchDocuments(parts: PublicPartDetailV1[], sets: PublicSetDetailV1[]): SearchDocumentV1[] {
  return [
    ...parts.map((part) => ({ id: part.id, slug: part.slug, type: 'part' as const, name: part.name, number: part.id, category: part.category?.name, score: part.statistics.commonalityScore })),
    ...sets.map((set) => ({ id: set.id, slug: set.slug, type: 'set' as const, name: set.name, number: set.id, theme: set.theme, year: set.year })),
  ].sort((left, right) => left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
}

function parseLaunchCohortConfig(value: unknown): LaunchCohortConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid launch cohort configuration.');
  const raw = value as Record<string, unknown>;
  const targets = raw.pageTypeTargets;
  if (!targets || typeof targets !== 'object') throw new Error('Launch cohort pageTypeTargets are required.');
  const pageTypeTargets = targets as Record<string, unknown>;
  return {
    version: requiredConfigString(raw, 'version'),
    minPages: requiredConfigInteger(raw, 'minPages'),
    targetPages: requiredConfigInteger(raw, 'targetPages'),
    maxPages: requiredConfigInteger(raw, 'maxPages'),
    pageTypeTargets: {
      part: requiredConfigInteger(pageTypeTargets, 'part'),
      donor: requiredConfigInteger(pageTypeTargets, 'donor'),
      relationship: requiredConfigInteger(pageTypeTargets, 'relationship'),
      set_support: requiredConfigInteger(pageTypeTargets, 'setSupport'),
      ranking_or_methodology: requiredConfigInteger(pageTypeTargets, 'rankingOrMethodology'),
    },
  };
}

function requiredConfigString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || !field.trim()) throw new Error(`Invalid launch cohort string: ${key}`);
  return field;
}

function requiredConfigInteger(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (!Number.isInteger(field) || Number(field) < 0) throw new Error(`Invalid launch cohort integer: ${key}`);
  return Number(field);
}

function buildLaunchCandidates(
  parts: PublicPartDetailV1[],
  donors: PublicDonorSetV1[],
  sets: PublicSetDetailV1[],
  rankings: ReturnType<typeof buildRankings>,
  config: LaunchCohortConfig,
): LaunchCandidate[] {
  const partBySlug = new Map(parts.map((part) => [part.slug, part]));
  const partOccurrences = parts.map((part) => part.statistics.setCount);
  const setSizes = sets.map((set) => set.totalParts);
  const targetTotal = Object.values(config.pageTypeTargets).reduce((sum, value) => sum + value, 0);

  const partCandidates = parts.map((part): LaunchCandidate => ({
    pageType: 'part',
    route: `/parts/${part.slug}/`,
    qualified: part.indexable,
    hardBlockReasons: part.indexable ? [] : ['part_indexability_gate'],
    components: {
      relationshipDepth: clamp01(part.relationships.length / 5),
      occurrenceDepth: logNormalize(part.statistics.setCount, partOccurrences),
      derivedInsightCount: clamp01([
        part.topColors.length > 0,
        part.topSets.length > 0,
        part.relationships.length > 0,
        part.statistics.setCount > 0,
        part.years.first !== undefined,
      ].filter(Boolean).length / 5),
      internalLinkValue: clamp01((part.topSets.length + part.relationships.length) / 20),
      metadataCompleteness: clamp01([
        Boolean(part.category),
        Boolean(part.image),
        part.years.first !== undefined,
        part.years.last !== undefined,
        Boolean(part.name && part.id),
      ].filter(Boolean).length / 5),
    },
  }));

  const donorCandidates = donors.map((donor): LaunchCandidate => {
    const part = partBySlug.get(donor.partSlug);
    return {
      pageType: 'donor',
      route: `/donor-sets/${donor.partSlug}/`,
      qualified: donor.indexable,
      hardBlockReasons: donor.indexable ? [] : ['donor_indexability_gate'],
      components: {
        relationshipDepth: clamp01((part?.relationships.length ?? 0) / 5),
        occurrenceDepth: part?.statistics.commonalityScore ?? 0,
        derivedInsightCount: clamp01(donor.candidates.length / 10),
        internalLinkValue: clamp01(donor.candidates.length / 10),
        metadataCompleteness: part ? 1 : 0.5,
      },
    };
  });

  const relationshipCandidates = parts.map((part): LaunchCandidate => {
    const qualified = part.indexable && part.relationships.length > 0;
    return {
      pageType: 'relationship',
      route: `/parts/${part.slug}/relationships/`,
      qualified,
      hardBlockReasons: qualified ? [] : ['relationship_depth_gate'],
      components: {
        relationshipDepth: clamp01(part.relationships.length / 5),
        occurrenceDepth: part.statistics.commonalityScore ?? 0,
        derivedInsightCount: clamp01(new Set(part.relationships.map((relation) => relation.type)).size / 3),
        internalLinkValue: clamp01(part.relationships.length / 10),
        metadataCompleteness: clamp01([Boolean(part.category), Boolean(part.name), Boolean(part.id), part.years.first !== undefined].filter(Boolean).length / 4),
      },
    };
  });

  const setCandidates = sets.map((set): LaunchCandidate => {
    const qualified = set.totalParts > 0 && set.parts.length >= 2;
    const relatedPartCount = set.parts.filter((item) => (partBySlug.get(item.slug)?.relationships.length ?? 0) > 0).length;
    return {
      pageType: 'set_support',
      route: `/sets/${set.slug}/`,
      qualified,
      hardBlockReasons: qualified ? [] : ['set_support_depth_gate'],
      components: {
        relationshipDepth: clamp01(relatedPartCount / Math.max(set.parts.length, 1)),
        occurrenceDepth: logNormalize(set.totalParts, setSizes),
        derivedInsightCount: clamp01([Boolean(set.theme), set.year !== undefined, set.parts.length >= 3].filter(Boolean).length / 3),
        internalLinkValue: clamp01(set.parts.length / 20),
        metadataCompleteness: clamp01([Boolean(set.id), Boolean(set.name), Boolean(set.theme), set.year !== undefined].filter(Boolean).length / 4),
      },
    };
  });

  const rankingCandidates = rankings.map((ranking): LaunchCandidate => {
    const qualified = ranking.rows.length >= 3;
    return {
      pageType: 'ranking_or_methodology',
      route: `/rankings/${ranking.slug}/`,
      qualified,
      hardBlockReasons: qualified ? [] : ['ranking_depth_gate'],
      components: {
        relationshipDepth: 0,
        occurrenceDepth: clamp01(ranking.rows.length / 50),
        derivedInsightCount: clamp01(ranking.rows.length / 20),
        internalLinkValue: clamp01(ranking.rows.length / 20),
        metadataCompleteness: 1,
      },
    };
  });

  const methodologyCandidates = [
    '/methodology/data-sources/',
    '/methodology/donor-score/',
    '/methodology/rarity/',
  ].map((route): LaunchCandidate => ({
    pageType: 'ranking_or_methodology',
    route,
    qualified: true,
    hardBlockReasons: [],
    components: {
      relationshipDepth: 0,
      occurrenceDepth: 0.25,
      derivedInsightCount: 1,
      internalLinkValue: 0.75,
      metadataCompleteness: 1,
    },
  }));

  if (targetTotal > config.maxPages) throw new Error('Launch page-type targets exceed the configured maximum.');
  return [...partCandidates, ...donorCandidates, ...relationshipCandidates, ...setCandidates, ...rankingCandidates, ...methodologyCandidates];
}

function routeEntitySlug(route: string, prefix: string): string {
  const segments = route.split('/').filter(Boolean);
  if (segments[0] !== prefix || !segments[1]) throw new Error(`Cannot extract ${prefix} entity slug from ${route}`);
  return segments[1];
}

async function writeLaunchArtifacts(
  rootDir: string,
  exportVersion: string,
  sourceSnapshot: string,
  config: LaunchCohortConfig,
  cohort: LaunchCohortResult,
): Promise<void> {
  const artifactDir = path.join(rootDir, 'artifacts', 'launch-cohort');
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  const pageView = (candidate: LaunchCohortResult['selected'][number]) => ({
    pageType: candidate.pageType,
    route: candidate.route,
    launchPriorityScore: candidate.launchPriorityScore,
    pageTypeDiversityBonus: candidate.pageTypeDiversityBonus,
    components: candidate.components,
  });
  await writeJson(artifactDir, 'launch_pages.json', cohort.selected.map(pageView));
  await writeJson(artifactDir, 'launch_pages_by_type.json', Object.fromEntries(
    LAUNCH_PAGE_TYPES.map((type) => [type, cohort.selected.filter((item) => item.pageType === type).map(pageView)]),
  ));
  await writeJson(artifactDir, 'excluded_candidates.json', cohort.excluded.map((candidate) => ({
    ...pageView(candidate),
    exclusionReason: candidate.exclusionReason,
    hardBlockReasons: candidate.hardBlockReasons,
  })));
  await writeJson(artifactDir, 'cohort_summary.json', {
    version: config.version,
    exportVersion,
    sourceSnapshot,
    totalPages: cohort.selected.length,
    minPages: config.minPages,
    targetPages: config.targetPages,
    maxPages: config.maxPages,
    launchReady: cohort.launchReady,
    coverage: cohort.byType,
  });
  await writeJson(artifactDir, 'methodology.json', {
    version: config.version,
    deterministicTieBreak: 'canonical_route_ascending',
    quotaPolicy: 'fill_page_type_targets_then_reallocate_to_highest_qualified_score_until_target',
    hardBlocksOverrideQuota: true,
    weights: {
      relationshipDepth: 0.3,
      occurrenceDepth: 0.25,
      derivedInsightCount: 0.15,
      internalLinkValue: 0.15,
      metadataCompleteness: 0.1,
      pageTypeDiversityBonus: 0.05,
    },
  });
}

async function writeJson(outputDir: string, relativePath: string, value: unknown): Promise<string> {
  const destination = path.join(outputDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, stableJson(value), 'utf8');
  return relativePath;
}

async function writeSitemaps(
  rootDir: string,
  updatedAt: string,
  selected: LaunchCohortResult['selected'],
): Promise<void> {
  const baseUrl = (process.env.APP_BASE_URL ?? 'https://example.com').replace(/\/$/, '');
  if (process.env.PRODUCTION_RELEASE === '1' && baseUrl === 'https://example.com') {
    throw new Error('Production release requires APP_BASE_URL.');
  }
  const sitemapDir = path.join(rootDir, 'public', 'sitemaps');
  await rm(sitemapDir, { recursive: true, force: true });
  await mkdir(sitemapDir, { recursive: true });
  const filenames: Record<LaunchPageType, string> = {
    part: 'parts.xml',
    donor: 'donor-sets.xml',
    relationship: 'relationships.xml',
    set_support: 'set-support.xml',
    ranking_or_methodology: 'rankings-and-methodology.xml',
  };
  const segments: Array<{ filename: string; count: number }> = [];
  for (const pageType of LAUNCH_PAGE_TYPES) {
    const urls = selected
      .filter((item) => item.pageType === pageType)
      .map((item) => `${baseUrl}${item.route}`);
    if (urls.length === 0) continue;
    const filename = filenames[pageType];
    await writeFile(path.join(sitemapDir, filename), renderUrlSet(urls, updatedAt), 'utf8');
    segments.push({ filename, count: urls.length });
  }
  await writeFile(path.join(rootDir, 'public', 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...segments.map((segment) => `  <sitemap><loc>${escapeXml(baseUrl)}/sitemaps/${segment.filename}</loc><lastmod>${updatedAt.slice(0, 10)}</lastmod></sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n'), 'utf8');
  await writeFile(path.join(rootDir, 'public', 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`, 'utf8');
}

function renderUrlSet(urls: string[], updatedAt: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.sort().map((url) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${updatedAt.slice(0, 10)}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function checksum(filename: string): Promise<string> {
  return createHash('sha256').update(await readFile(filename)).digest('hex');
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry);
    return (await stat(absolute)).isDirectory() ? listFiles(absolute) : [absolute];
  }));
  return files.flat();
}
