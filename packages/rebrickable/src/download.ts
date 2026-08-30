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
      const response = await fetch(options.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'lego-parts-intelligence-source-adapter/0.1' },
      });
      if (!response.ok || !response.body) throw new Error(`Download failed with HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (declaredLength > maxBytes) throw new Error(`Source file exceeds ${maxBytes} byte guard.`);

      const file = await open(destination, 'w');
      const digest = createHash('sha256');
      let bytes = 0;
      const reader = response.body.getReader();
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
      return { name: path.basename(destination), sourceUrl: options.url.toString(), sha256: digest.digest('hex'), bytes };
    } catch (error) {
      lastError = error;
      await rm(destination, { force: true });
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Source download failed.');
}
