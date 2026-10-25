// `npm run check`: the gate every change must pass before it can merge.
// 1. editorial rules on the data   2. regressions vs origin/main   2b. held photos
// 2c. sales and listings
// 3. full build (schema validation happens here)   4. checks on the built site
import { execSync } from 'node:child_process';
import { checkSources } from './check-sources.mjs';
import { checkRegressions } from './check-regressions.mjs';
import { checkSite } from './check-site.mjs';
import { checkPending } from './check-pending.mjs';
import { checkSales } from './check-sales.mjs';
import { ROOT } from './lib.mjs';

let ok = true;
ok = checkSources().print() && ok;
ok = checkRegressions().print() && ok;
ok = checkPending().print() && ok;
ok = checkSales().print() && ok;

try {
  execSync('npm run build', { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  console.log('ok  build and schema');
} catch (e) {
  console.log('FAIL  build and schema');
  console.log(String(e.stderr ?? e.message).split('\n').slice(-30).join('\n'));
  process.exit(1);
}
ok = checkSite().print() && ok;

console.log(ok ? '\nAll checks passed.' : '\nChecks failed. Fix the FAIL lines above; do not merge.');
process.exit(ok ? 0 : 1);
