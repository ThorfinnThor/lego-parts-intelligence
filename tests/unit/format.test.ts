import { describe, expect, it } from 'vitest';
import { pluralize } from '../../lib/format';

describe('display formatting', () => {
  it('uses singular and plural labels deterministically', () => {
    expect(pluralize(1, 'set')).toBe('1 set');
    expect(pluralize(2, 'set')).toBe('2 sets');
    expect(pluralize(1, 'category', 'categories')).toBe('1 category');
  });
});
