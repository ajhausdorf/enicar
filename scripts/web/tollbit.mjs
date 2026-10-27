// Fetch a page from a site that licenses bot access through TollBit (such as
// WatchUSeek), using the owner's TollBit developer account. This is the
// publisher's own paid route; never work around their bot gate any other way.
//
//   node scripts/web/tollbit.mjs <page-url> [--max-usd 0.05] [--out file.md]
//
// Needs TOLLBIT_KEY and TOLLBIT_AGENT_ID (the AgentID registered in the
// TollBit dashboard) in the environment or in .env, which git ignores.
// --max-usd is the most we will pay for this one page; it defaults to 0, which
// only fetches free pages. Raise it only with the owner's OK on the amount.
// The key goes to gateway.tollbit.com only, never to the publisher.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const args = process.argv.slice(2);
const page = args.find((a) => /^https?:\/\//.test(a));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!page) { console.error('usage: tollbit.mjs <page-url> [--max-usd 0.05] [--out file.md]'); process.exit(1); }

const env = { ...process.env };
const f = join(ROOT, '.env');
if (existsSync(f)) for (const line of readFileSync(f, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!env.TOLLBIT_KEY || !env.TOLLBIT_AGENT_ID) {
  console.error('Set TOLLBIT_KEY and TOLLBIT_AGENT_ID in .env at the repo root (git ignores it).');
  process.exit(1);
}

const u = new URL(page);
const maxPriceMicros = Math.round(Number(opt('--max-usd') ?? 0) * 1e6);
const res = await fetch('https://gateway.tollbit.com/dev/v2/tokens/content', {
  method: 'POST',
  headers: { TollbitKey: env.TOLLBIT_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: u.host.replace(/^www\./, '') + u.pathname, userAgent: env.TOLLBIT_AGENT_ID, maxPriceMicros, currency: 'USD', licenseType: 'ON_DEMAND_LICENSE' })
});
if (!res.ok) { console.error(`token request failed: ${res.status} ${await res.text()}`); process.exit(1); }
const { token } = await res.json();

const gated = `https://tollbit.${u.host.replace(/^www\./, '')}${u.pathname}${u.search}`;
const page2 = await fetch(gated, { headers: { 'Tollbit-Token': token, 'User-Agent': env.TOLLBIT_AGENT_ID, 'Tollbit-Accept-Content': 'text/markdown' } });
const body = await page2.text();
if (!page2.ok) { console.error(`page fetch failed: ${page2.status} ${body.slice(0, 300)}`); process.exit(1); }
const out = opt('--out');
if (out) { writeFileSync(out, body); console.log(`${body.length} chars -> ${out}`); } else process.stdout.write(body);
