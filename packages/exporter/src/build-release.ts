import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
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
import { commonalityScore, roundScore, scoreDonorCandidates } from '../../scoring/src/index';
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
type CsvRow = Record<string, string>;

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

export async function buildFixtureRelease(rootDir: string): Promise<ReleaseSummary> {
  const fixtureDir = path.join(rootDir, 'data', 'fixtures');
  const outputDir = path.join(rootDir, 'public', 'data');
  const sourceConfig = dataSourceConfigSchema.parse(
    JSON.parse(await readFile(path.join(rootDir, 'config', 'data-sources.json'), 'utf8')),
  );
  enforceSourceGate(sourceConfig);

  const [colorRows, categoryRows, themeRows, partRows, setRows, inventoryRows, inventoryPartRows, relationshipRows] =
    await Promise.all([
      readCsv(fixtureDir, 'colors.csv'),
      readCsv(fixtureDir, 'part_categories.csv'),
      readCsv(fixtureDir, 'themes.csv'),
      readCsv(fixtureDir, 'parts.csv'),
      readCsv(fixtureDir, 'sets.csv'),
      readCsv(fixtureDir, 'inventories.csv'),
      readCsv(fixtureDir, 'inventory_parts.csv'),
      readCsv(fixtureDir, 'part_relationships.csv'),
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
  const publicParts = buildPublicParts({
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
  const donorPages = buildDonorPages({ exportVersion, parts, sets, inventories, inventoryParts, stats });
  const publicSets = buildPublicSets({ exportVersion, sets, themes, parts, inventories, inventoryParts });
  const rankings = buildRankings(exportVersion, publicParts);
  const searchDocuments = buildSearchDocuments(publicParts, publicSets);

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

  const launchCandidates = [
    ...publicParts.filter((part) => part.indexable).map((part) => ({ type: 'part', slug: part.slug })),
    ...donorPages.filter((page) => page.indexable).map((page) => ({ type: 'donor', slug: page.partSlug })),
    ...rankings.map((ranking) => ({ type: 'ranking', slug: ranking.slug })),
  ].sort((left, right) => left.type.localeCompare(right.type) || left.slug.localeCompare(right.slug));
  const cohortConfig = JSON.parse(await readFile(path.join(rootDir, 'config', 'launch-cohort.json'), 'utf8')) as {
    version: string; minPages: number; targetPages: number; maxPages: number;
  };
  const selected = launchCandidates.slice(0, cohortConfig.maxPages);
  if (process.env.PRODUCTION_RELEASE === '1' && selected.length < cohortConfig.minPages) {
    throw new Error(`Production launch blocked: only ${selected.length} qualified pages; ${cohortConfig.minPages} required.`);
  }
  writtenFiles.push(await writeJson(outputDir, 'cohort-summary.json', {
    version: cohortConfig.version,
    totalPages: selected.length,
    targetPages: cohortConfig.targetPages,
    launchReady: selected.length >= cohortConfig.minPages,
    mode: process.env.PRODUCTION_RELEASE === '1' ? 'production' : 'fixture-preview',
    sourceRelease: exportVersion,
    indexabilityMethodology: 'indexability-v1',
  }));

  await writeSitemaps(rootDir, exportVersion, selected, publicSets);
  const checksums = Object.fromEntries(
    await Promise.all(writtenFiles.sort().map(async (relative) => [relative, await checksum(path.join(outputDir, relative))])),
  );
  const manifest: PublicManifestV1 = {
    schemaVersion: 1,
    exportVersion,
    source: 'rebrickable',
    sourceSnapshot: 'fixtures-v1',
    generatedAt: exportVersion,
    methodologies: {
      partStatistics: 'part-stats-v1',
      donorScore: 'donor-v1',
      indexability: 'indexability-v1',
    },
    counts: {
      parts: publicParts.length,
      sets: publicSets.length,
      partPages: publicParts.filter((part) => part.indexable).length,
      donorPages: donorPages.filter((page) => page.indexable).length,
      rankings: rankings.length,
    },
    routes: {
      parts: publicParts.map((part) => part.slug).sort(),
      donors: donorPages.filter((page) => page.indexable).map((page) => page.partSlug).sort(),
      sets: publicSets.map((set) => set.slug).sort(),
      rankings: rankings.map((ranking) => ranking.slug).sort(),
    },
    searchIndexes: ['/data/search-index/catalogue.json'],
    checksums,
  };
  await writeJson(outputDir, 'manifest.json', manifest);

  return {
    exportVersion,
    parts: publicParts.length,
    sets: publicSets.length,
    indexablePages: selected.length,
    donorPages: manifest.counts.donorPages,
    files: (await listFiles(outputDir)).length,
  };
}

function enforceSourceGate(config: ReturnType<typeof dataSourceConfigSchema.parse>): void {
  if (config.status === 'blocked' || !config.catalogCommercialUse || config.mocImages) {
    throw new Error('Source rights gate blocked this export.');
  }
  if (process.env.PRODUCTION_RELEASE === '1' && !config.productionApproval) {
    throw new Error('Production release blocked: operator/legal productionApproval is false.');
  }
}

async function readCsv(directory: string, filename: string): Promise<CsvRow[]> {
  const content = await readFile(path.join(directory, filename), 'utf8');
  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as CsvRow[];
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
  if (url && /(?:^|\/)mocs?(?:\/|$)/i.test(new URL(url).pathname)) {
    throw new Error(`MOC images are never exportable: ${url}`);
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

async function writeJson(outputDir: string, relativePath: string, value: unknown): Promise<string> {
  const destination = path.join(outputDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, stableJson(value), 'utf8');
  return relativePath;
}

async function writeSitemaps(
  rootDir: string,
  updatedAt: string,
  selected: Array<{ type: string; slug: string }>,
  sets: PublicSetDetailV1[],
): Promise<void> {
  const baseUrl = (process.env.APP_BASE_URL ?? 'https://example.com').replace(/\/$/, '');
  if (process.env.PRODUCTION_RELEASE === '1' && baseUrl === 'https://example.com') {
    throw new Error('Production release requires APP_BASE_URL.');
  }
  const sitemapDir = path.join(rootDir, 'public', 'sitemaps');
  await rm(sitemapDir, { recursive: true, force: true });
  await mkdir(sitemapDir, { recursive: true });
  const urls = selected.map((item) => {
    const prefix = item.type === 'part' ? 'parts' : item.type === 'donor' ? 'donor-sets' : 'rankings';
    return `${baseUrl}/${prefix}/${item.slug}/`;
  });
  const supportUrls = sets.map((set) => `${baseUrl}/sets/${set.slug}/`);
  await writeFile(path.join(sitemapDir, 'catalogue-1.xml'), renderUrlSet([...urls, ...supportUrls], updatedAt), 'utf8');
  await writeFile(path.join(rootDir, 'public', 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <sitemap><loc>${escapeXml(baseUrl)}/sitemaps/catalogue-1.xml</loc><lastmod>${updatedAt.slice(0, 10)}</lastmod></sitemap>`,
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
