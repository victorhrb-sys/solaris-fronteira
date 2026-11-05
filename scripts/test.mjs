// Keep each suite in its own process: several tests replace Math.random or
// install fake browser storage, which must not leak into the next suite.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  'approved-map-test.mjs',
  'test.mjs',
  'route-test.mjs',
  'multiplayer-test.mjs',
  'combat-defense-test.mjs',
  'duel-test.mjs',
  'fog-test.mjs',
  'bot-profile-test.mjs',
  'online-test.mjs',
  'online-usability-test.mjs',
];
// The longer balance simulation is opt-in; its known 200-tick limit is
// documented in docs/development.md and is not a guaranteed game rule.
if (process.argv.includes('--simulation')) suites.push('bot-simulation-test.mjs');

const failed = [];
for (const suite of suites) {
  console.log(`\nRunning ${suite}`);
  const result = spawnSync(process.execPath, [suite], {cwd: root, stdio: 'inherit'});
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) failed.push(suite);
}
console.log(`\n${suites.length - failed.length}/${suites.length} suites passed.`);
if (failed.length) console.error(`Failed: ${failed.join(', ')}`);
process.exitCode = failed.length ? 1 : 0;
