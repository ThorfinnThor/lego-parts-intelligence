import path from 'node:path';
import { buildFixtureRelease } from '../packages/exporter/src/build-release';

const summary = await buildFixtureRelease(path.resolve(process.cwd()));
console.log(JSON.stringify({ event: 'fixture_release_built', ...summary }));
