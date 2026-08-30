import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  publicDonorSetSchema,
  publicPartDetailSchema,
  type PublicDonorSetV1,
  type PublicManifestV1,
  type PublicPartDetailV1,
  type PublicSetDetailV1,
} from '../../packages/data-contracts/src/index';

interface RouteTarget { id: string; shard?: string }
interface RouteMap {
  parts: Record<string, RouteTarget>;
  donors: Record<string, RouteTarget>;
  sets: Record<string, RouteTarget>;
  rankings: Record<string, RouteTarget>;
}

function dataPath(...segments: string[]): string {
  return path.join(process.cwd(), 'public', 'data', ...segments);
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(dataPath(...segments), 'utf8')) as T;
}

export function getManifest(): PublicManifestV1 {
  return readJson<PublicManifestV1>('manifest.json');
}

function getRouteMap(): RouteMap {
  return readJson<RouteMap>('routes.json');
}

export function getPartBySlug(slug: string): PublicPartDetailV1 | undefined {
  const target = getRouteMap().parts[slug];
  if (!target?.shard) return undefined;
  return publicPartDetailSchema.parse(readJson('parts', target.shard, `${target.id}.json`));
}

export function getDonorData(slug: string): PublicDonorSetV1 | undefined {
  const target = getRouteMap().donors[slug];
  if (!target?.shard) return undefined;
  return publicDonorSetSchema.parse(readJson('donor-sets', target.shard, `${target.id}.json`));
}

export function getSetBySlug(slug: string): PublicSetDetailV1 | undefined {
  const target = getRouteMap().sets[slug];
  return target ? readJson<PublicSetDetailV1>('sets', `${target.id}.json`) : undefined;
}

export interface RankingData {
  schemaVersion: 1;
  exportVersion: string;
  slug: string;
  title: string;
  description: string;
  methodologyVersion: string;
  updatedAt: string;
  rows: Array<{ rank: number; id: string; slug: string; name: string; setCount: number; score?: number }>;
}

export function getRanking(slug: string): RankingData | undefined {
  return getRouteMap().rankings[slug] ? readJson<RankingData>('rankings', `${slug}.json`) : undefined;
}

export function getPartPageParams(): Array<{ partSlug: string }> {
  return getManifest().routes.parts.map((partSlug) => ({ partSlug }));
}

export function getDonorPageParams(): Array<{ partSlug: string }> {
  return getManifest().routes.donors.map((partSlug) => ({ partSlug }));
}

export function getSetPageParams(): Array<{ setSlug: string }> {
  return getManifest().routes.sets.map((setSlug) => ({ setSlug }));
}

export function getRankingPageParams(): Array<{ rankingSlug: string }> {
  return getManifest().routes.rankings.map((rankingSlug) => ({ rankingSlug }));
}

export function getAllParts(): PublicPartDetailV1[] {
  return getManifest().routes.parts.map((slug) => getPartBySlug(slug)).filter((part): part is PublicPartDetailV1 => Boolean(part));
}
