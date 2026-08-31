import { createHash } from 'node:crypto';
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';

export interface DownloadOptions {
  url: URL;
  filename: string;
  snapshotDir: string;
  maxBytes?: number;
  retries?: number;
  timeoutMs?: number;
}

export interface DownloadResult {
  name: string;
  sourceUrl: string;
  sha256: string;
  bytes: number;
  sourceCompression: 'gzip' | 'identity';
}

const MAX_REDIRECTS = 5;

export function assertApprovedSourceUrl(url: URL): void {
  const hostname = url.hostname.toLowerCase();
  const isRebrickableHost = hostname === 'rebrickable.com' || hostname.endsWith('.rebrickable.com');
  if (url.protocol !== 'https:' || !isRebrickableHost || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error(`Source URL must use HTTPS on an approved Rebrickable host: ${url.origin}`);
  }
}

export function decodeSourceBody(
  sourceUrl: URL,
  body: ReadableStream<Uint8Array>,
): { body: ReadableStream<Uint8Array>; sourceCompression: 'gzip' | 'identity' } {
  const sourceCompression = sourceUrl.pathname.toLowerCase().endsWith('.gz') ? 'gzip' : 'identity';
  // TypeScript's DOM declarations model DecompressionStream as BufferSource,
  // while Node's fetch stream exposes Uint8Array. The runtime accepts the latter.
  const gzipDecoder = new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>;
  return {
    body: sourceCompression === 'gzip' ? body.pipeThrough(gzipDecoder) : body,
    sourceCompression,
  };
}

export async function downloadSnapshotFile(options: DownloadOptions): Promise<DownloadResult> {
  const maxBytes = options.maxBytes ?? 512 * 1024 * 1024;
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 60_000;
  await mkdir(options.snapshotDir, { recursive: true });
  const destination = path.join(options.snapshotDir, path.basename(options.filename));

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const { response, finalUrl } = await fetchApprovedSource(options.url, AbortSignal.timeout(timeoutMs));
      if (!response.ok || !response.body) throw new Error(`Download failed with HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (declaredLength > maxBytes) throw new Error(`Source file exceeds ${maxBytes} byte guard.`);

      const file = await open(destination, 'w');
      const digest = createHash('sha256');
      let bytes = 0;
      const { body: sourceBody, sourceCompression } = decodeSourceBody(finalUrl, response.body);
      const reader = sourceBody.getReader();
      try {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          bytes += chunk.byteLength;
          if (bytes > maxBytes) throw new Error(`Source stream exceeded ${maxBytes} byte guard.`);
          digest.update(chunk);
          await file.write(chunk);
        }
      } finally {
        reader.releaseLock();
        await file.close();
      }
      return {
        name: path.basename(destination),
        sourceUrl: options.url.toString(),
        sha256: digest.digest('hex'),
        bytes,
        sourceCompression,
      };
    } catch (error) {
      lastError = error;
      await rm(destination, { force: true });
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Source download failed.');
}

async function fetchApprovedSource(
  initialUrl: URL,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertApprovedSourceUrl(currentUrl);
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': 'lego-parts-intelligence-source-adapter/0.1' },
    });
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: currentUrl };

    const location = response.headers.get('location');
    if (!location) throw new Error(`Source redirect ${response.status} omitted its Location header.`);
    await response.body?.cancel();
    currentUrl = new URL(location, currentUrl);
  }
  throw new Error(`Source download exceeded ${MAX_REDIRECTS} redirects.`);
}
