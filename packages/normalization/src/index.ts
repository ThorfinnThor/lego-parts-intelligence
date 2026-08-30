export function normalizeDisplayString(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function normalizeLookupString(value: string): string {
  return normalizeDisplayString(value).toLocaleLowerCase('en-US');
}

export function createStableSlug(stableId: string, name: string): string {
  const normalized = normalizeDisplayString(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return `${stableId}-${normalized || 'item'}`;
}

export function shardPrefix(stableId: string): string {
  return stableId.padEnd(2, '_').slice(0, 2).toLocaleLowerCase('en-US');
}
