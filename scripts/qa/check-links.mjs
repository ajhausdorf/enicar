// Confirms every source and citation URL still answers. Needs the network, so
// it runs in CI and weekly rather than in `npm run check`.
//   node scripts/qa/check-links.mjs           all URLs
//   node scripts/qa/check-links.mjs --changed only records changed vs origin/main
import { execFileSync } from 'node:child_process';
import { loadReferences, loadSources, Report, ROOT } from './lib.mjs';

const onlyChanged = process.argv.includes('--changed');
const base = process.env.QA_BASE ?? 'origin/main';

function changedIds() {
  try {
    const out = execFileSync('git', ['diff', '--name-only', base, '--', 'data/references'], { cwd: ROOT, encoding: 'utf8' });
    return new Set(out.split('\n').filter(Boolean).map((f) => f.replace(/^data\/references\//, '').replace(/\.yaml$/, '')));
  } catch { return null; }
}

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'EnicarArchiveLinkCheck/1.0' } });
      if (res.status < 400) return { ok: true, status: res.status };
      if (method === 'GET') return { ok: false, status: res.status };
    } catch (e) {
      if (method === 'GET') return { ok: false, status: e.name };
    }
  }
}

const r = new Report('links');
const ids = onlyChanged ? changedIds() : null;
const urls = new Map();
if (!onlyChanged) for (const s of loadSources()) urls.set(s.url, 'data/sources.yaml');
for (const { id, file, data } of loadReferences()) {
  if (ids && !ids.has(id)) continue;
  for (const c of data.citations ?? []) urls.set(c.url, file);
  for (const img of data.images ?? []) if (img.credit_url) urls.set(img.credit_url, file);
  for (const p of data.photos_elsewhere ?? []) urls.set(p.url, file);
}

const results = await Promise.all([...urls].map(async ([url, where]) => [url, where, await probe(url)]));
for (const [url, where, res] of results) {
  // 403/429 usually means bot protection, not a dead page: warn, don't fail.
  if (!res.ok && (res.status === 403 || res.status === 429)) r.warn(where, `${url} answered ${res.status} (likely bot protection; check by hand)`);
  else if (!res.ok) r.error(where, `${url} → ${res.status}`);
}
console.log(`checked ${urls.size} URLs`);
process.exit(r.print() ? 0 : 1);
