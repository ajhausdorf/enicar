// data/pending-photos.yaml: every held photo still has its original in
// incoming/<account>/img/, names a known account, and isn't also on the site.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { loadReferences, loadPermissions, Report, ROOT } from './lib.mjs';

export function checkPending() {
  const r = new Report('pending photos');
  const p = join(ROOT, 'data/pending-photos.yaml');
  if (!existsSync(p)) return r;
  const { pending = [], excluded = [] } = YAML.parse(readFileSync(p, 'utf8')) ?? {};
  const perms = loadPermissions();
  const accounts = new Set(perms.map((x) => x.profile_url.replace(/\/$/, '').split('/').pop()));
  // Folders of website photos (scripts/web/pages.mjs) count when their pages
  // are on a site some entry's `web.site` covers.
  const host = (u) => new URL(u).host.replace(/^www\./, '');
  const sites = new Set(perms.filter((x) => x.web?.site).map((x) => host(x.web.site)));
  const incoming = join(ROOT, 'incoming');
  for (const d of existsSync(incoming) ? readdirSync(incoming) : []) {
    const f = join(incoming, d, 'posts.json');
    const url = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).find((x) => x.url)?.url : null;
    if (url && sites.has(host(url))) accounts.add(d);
  }
  // Photos on the site, as "<account>/<code>/<n>", recovered from source_url and file name.
  const placed = new Set();
  for (const { data } of loadReferences()) {
    for (const img of data.images ?? []) {
      const code = (img.source_url ?? '').match(/instagram\.com\/p\/([^/]+)/)?.[1];
      const n = img.file.match(/-(\d+)\.webp$/)?.[1];
      if (code && n) placed.add(`${code}/${Number(n)}`);
    }
  }
  const seen = new Set();
  for (const x of pending) {
    const where = `pending ${x.code}`;
    if (!accounts.has(x.account)) r.error(where, `account "${x.account}" has no entry in data/permissions.yaml`);
    if (!x.question || !x.evidence?.length) r.error(where, 'needs a question and the evidence behind it');
    for (const n of x.photos ?? []) {
      const key = `${x.code}/${n}`;
      if (seen.has(key)) r.error(where, `photo ${n} is listed twice`);
      seen.add(key);
      if (placed.has(key)) r.error(where, `photo ${n} is already on the site; delete it from pending-photos.yaml`);
      const f = join(ROOT, 'incoming', x.account, 'img', `${x.code}_${String(n).padStart(2, '0')}.webp`);
      if (!existsSync(f)) r.error(where, `original missing: ${f.replace(ROOT, '')}`);
    }
  }
  for (const x of excluded) if (!x.reason) r.error(`excluded ${x.code}`, 'needs a reason');
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(checkPending().print() ? 0 : 1);
