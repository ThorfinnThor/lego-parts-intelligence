PRAGMA foreign_keys = ON;

CREATE TABLE data_import_runs (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_version TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('started','downloaded','validated','importing','completed','failed','quarantined')),
  raw_checksum TEXT,
  source_manifest TEXT NOT NULL DEFAULT '{}',
  row_counts TEXT NOT NULL DEFAULT '{}',
  validation_summary TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE colors (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  rgb TEXT,
  is_transparent INTEGER NOT NULL DEFAULT 0 CHECK (is_transparent IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  import_batch_id TEXT REFERENCES data_import_runs(id)
);

CREATE TABLE part_categories (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_source_id TEXT REFERENCES part_categories(source_id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  import_batch_id TEXT REFERENCES data_import_runs(id)
);

CREATE TABLE parts (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_source_id TEXT REFERENCES part_categories(source_id),
  image_url TEXT,
  image_license_status TEXT NOT NULL DEFAULT 'source_policy',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  metadata TEXT NOT NULL DEFAULT '{}',
  import_batch_id TEXT REFERENCES data_import_runs(id)
);

CREATE TABLE themes (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_source_id TEXT REFERENCES themes(source_id),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  import_batch_id TEXT REFERENCES data_import_runs(id)
);

CREATE TABLE sets (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  year INTEGER,
  theme_source_id TEXT REFERENCES themes(source_id),
  num_parts INTEGER CHECK (num_parts >= 0),
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  metadata TEXT NOT NULL DEFAULT '{}',
  import_batch_id TEXT REFERENCES data_import_runs(id)
);

CREATE TABLE inventories (
  source_id TEXT PRIMARY KEY,
  set_source_id TEXT NOT NULL REFERENCES sets(source_id),
  version INTEGER,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  import_batch_id TEXT REFERENCES data_import_runs(id)
);

CREATE TABLE inventory_parts (
  inventory_source_id TEXT NOT NULL REFERENCES inventories(source_id),
  part_source_id TEXT NOT NULL REFERENCES parts(source_id),
  color_source_id TEXT NOT NULL REFERENCES colors(source_id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  is_spare INTEGER NOT NULL DEFAULT 0 CHECK (is_spare IN (0,1)),
  import_batch_id TEXT REFERENCES data_import_runs(id),
  PRIMARY KEY (inventory_source_id, part_source_id, color_source_id, is_spare)
);

CREATE TABLE part_relationships (
  parent_part_source_id TEXT NOT NULL REFERENCES parts(source_id),
  child_part_source_id TEXT NOT NULL REFERENCES parts(source_id),
  relationship_type TEXT NOT NULL,
  evidence_type TEXT NOT NULL DEFAULT 'source_declared',
  confidence_score REAL CHECK (confidence_score BETWEEN 0 AND 1),
  import_batch_id TEXT REFERENCES data_import_runs(id),
  PRIMARY KEY (parent_part_source_id, child_part_source_id, relationship_type)
);

CREATE INDEX inventory_parts_part_idx ON inventory_parts(part_source_id);
CREATE INDEX inventories_set_idx ON inventories(set_source_id);
CREATE INDEX sets_theme_idx ON sets(theme_source_id);
