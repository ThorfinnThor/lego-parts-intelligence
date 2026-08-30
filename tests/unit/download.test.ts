import { describe, expect, it } from 'vitest';
import { assertApprovedSourceUrl } from '../../packages/rebrickable/src/download';

describe('source download boundary', () => {
  it.each([
    'https://rebrickable.com/downloads/',
    'https://cdn.rebrickable.com/media/downloads/parts.csv.gz',
  ])('accepts an HTTPS Rebrickable URL: %s', (value) => {
    expect(() => assertApprovedSourceUrl(new URL(value))).not.toThrow();
  });

  it.each([
    'http://rebrickable.com/downloads/parts.csv',
    'https://rebrickable.com.evil.example/parts.csv',
    'https://user:password@rebrickable.com/parts.csv',
    'https://rebrickable.com:8443/parts.csv',
  ])('rejects an unsafe source URL: %s', (value) => {
    expect(() => assertApprovedSourceUrl(new URL(value))).toThrow(/approved Rebrickable host/);
  });
});
