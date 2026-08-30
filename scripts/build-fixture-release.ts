import path from 'node:path';
import { buildFixtureRelease } from '../packages/exporter/src/build-release';

const summary = await buildFixtureRelease(path.resolve(process.cwd()));
console.log(JSON.stringify({ event: process.env.SOURCE_SNAPSHOT_DIR ? 'source_release_built' : 'fixture_release_built', ...summary }));
