import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse';

export type SourceCsvRow = Record<string, string>;

/**
 * The public exporter intentionally supports a small, explicit subset of the
 * Rebrickable bulk catalogue. Keeping this list here makes a snapshot
 * self-describing and prevents an accidental partial import.
 */
export const SNAPSHOT_FILES = [
  'colors.csv',
  'part_categories.csv',
  'themes.csv',
  'parts.csv',
  'sets.csv',
  'inventories.csv',
  'inventory_parts.csv',
  'minifigs.csv',
  'inventory_minifigs.csv',
  'part_relationships.csv',
] as const;

export const SNAPSHOT_REQUIRED_HEADERS: Record<string, readonly string[]> = {
  'colors.csv': ['id', 'name', 'rgb', 'is_trans'],
  'part_categories.csv': ['id', 'name'],
  'themes.csv': ['id', 'name'],
  'parts.csv': ['part_num', 'name', 'part_cat_id', 'part_img_url'],
  'sets.csv': ['set_num', 'name', 'year', 'theme_id', 'num_parts', 'set_img_url'],
  'inventories.csv': ['id', 'version', 'set_num'],
  'inventory_parts.csv': ['inventory_id', 'part_num', 'color_id', 'quantity', 'is_spare'],
  'minifigs.csv': ['fig_num', 'name', 'num_parts', 'img_url'],
  'inventory_minifigs.csv': ['inventory_id', 'fig_num', 'quantity'],
  'part_relationships.csv': ['rel_type', 'child_part_num', 'parent_part_num'],
};

export interface SnapshotValidation {
  directory: string;
  missingFiles: string[];
  files: string[];
}

export async function validateSnapshotDirectory(directory: string): Promise<SnapshotValidation> {
  const missingFiles: string[] = [];
  for (const filename of SNAPSHOT_FILES) {
    try {
      await access(path.join(directory, filename));
    } catch {
      missingFiles.push(filename);
    }
  }
  return { directory, missingFiles, files: [...SNAPSHOT_FILES].filter((file) => !missingFiles.includes(file)) };
}

export async function assertSnapshotDirectory(directory: string): Promise<void> {
  const validation = await validateSnapshotDirectory(directory);
  if (validation.missingFiles.length > 0) {
    throw new Error(`Source snapshot is incomplete. Missing: ${validation.missingFiles.join(', ')}`);
  }
}

/** Parse one CSV through a file stream so large source files are not first copied into a string. */
export async function readSnapshotCsv(directory: string, filename: string): Promise<SourceCsvRow[]> {
  const required = SNAPSHOT_REQUIRED_HEADERS[filename] ?? [];
  const rows: SourceCsvRow[] = [];
  const parser = createReadStream(path.join(directory, filename)).pipe(parse({
    bom: true,
    columns: (headers: string[]) => {
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length > 0) {
        throw new Error(`${filename} is missing required headers: ${missing.join(', ')}`);
      }
      const extra = headers.filter((header) => !required.includes(header));
      if (extra.length > 0) {
        console.warn(JSON.stringify({ event: 'source_csv_extra_columns', filename, columns: extra }));
      }
      return headers;
    },
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }));
  for await (const row of parser) rows.push(row as SourceCsvRow);
  return rows;
}

export async function readSnapshotLabel(directory: string): Promise<string> {
  try {
    const raw = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')) as Record<string, unknown>;
    if (typeof raw.snapshotId === 'string' && raw.snapshotId.trim()) return raw.snapshotId.trim();
    if (typeof raw.retrievedAt === 'string' && raw.retrievedAt.trim()) return `rebrickable-${raw.retrievedAt.trim()}`;
  } catch {
    // A manifest is optional for local fixtures; the directory name is still deterministic.
  }
  return path.basename(directory) === 'fixtures' ? 'fixtures-v1' : path.basename(directory);
}
