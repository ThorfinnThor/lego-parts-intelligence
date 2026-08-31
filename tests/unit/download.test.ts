import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { assertApprovedSourceUrl, decodeSourceBody } from '../../packages/rebrickable/src/download';

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

  it('streams official gzip downloads into canonical CSV bytes', async () => {
    const compressed = gzipSync('id,name\n1,Black\n');
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(compressed);
        controller.close();
      },
    });
    const decoded = decodeSourceBody(new URL('https://cdn.rebrickable.com/media/downloads/colors.csv.gz'), input);

    expect(decoded.sourceCompression).toBe('gzip');
    await expect(new Response(decoded.body).text()).resolves.toBe('id,name\n1,Black\n');
  });
});
