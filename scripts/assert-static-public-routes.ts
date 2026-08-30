import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const appDir = path.join(root, 'app');
const forbidden = [
  { pattern: /@supabase\//, reason: 'Supabase imports are forbidden in public routes.' },
  { pattern: /https?:\/\/[^'"\s]*supabase\.(?:co|com)/, reason: 'Supabase network calls are forbidden in public routes.' },
  { pattern: /\bforce-dynamic\b/, reason: 'Public catalogue routes must not force dynamic rendering.' },
  { pattern: /['"]use server['"]/, reason: 'Server Actions are forbidden for public catalogue reads.' },
  { pattern: /from ['"]next\/headers['"]/, reason: 'Request headers/cookies can force dynamic rendering.' },
];

const failures: string[] = [];
for (const file of await sourceFiles(appDir)) {
  const source = await readFile(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) failures.push(`${path.relative(root, file)}: ${rule.reason}`);
  }
}
if (failures.length) throw new Error(`Static public contract failed:\n${failures.join('\n')}`);
console.log(JSON.stringify({ event: 'static_public_contract_passed' }));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  }));
  return nested.flat();
}
