import { describe, expect, it } from 'vitest';
import { stableJson } from '../../packages/exporter/src/stable-json';

describe('stable JSON', () => {
  it('orders object keys recursively without reordering arrays', () => {
    expect(stableJson({ z: 1, a: { y: 2, b: 3 }, rows: [{ z: 1, a: 2 }] })).toBe(
      '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "rows": [\n    {\n      "a": 2,\n      "z": 1\n    }\n  ],\n  "z": 1\n}\n',
    );
  });
});
