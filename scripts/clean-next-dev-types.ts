import { rm } from 'node:fs/promises';
import path from 'node:path';

// Next typegen writes production route types, but a previously interrupted dev
// server can leave a conflicting second set of generated global route types.
await rm(path.join(process.cwd(), '.next', 'dev', 'types'), { recursive: true, force: true });
