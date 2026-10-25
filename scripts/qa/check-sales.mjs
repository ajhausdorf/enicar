// data/sales.yaml: every sale and listing names a real record (and a real
// generation on it), has a kind, currency, title and positive price, an https
// link used only once, and valid dates. Whether the link really is that
// sale's page is checked by the update-prices review, not here.
// Listings not re-checked recently are warnings: the page already hides them,
// and the next update run should re-check or remove them.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { loadReferences, Report, ROOT } from './lib.mjs';

const FRESH_DAYS = 21; // keep in step with LISTING_FRESH_DAYS in src/lib/site.ts
const day = 864e5;
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'HKD', 'SEK', 'JPY']; // as in src/content.config.ts

export function checkSales() {
  const r = new Report('sales and listings');
  const p = join(ROOT, 'data/sales.yaml');
  if (!existsSync(p)) return r;
  const rows = YAML.parse(readFileSync(p, 'utf8')) ?? [];
  const refs = new Map(loadReferences().map((x) => [x.id, x.data]));
  const ids = new Set(), urls = new Set();
  const today = Date.now();
  for (const s of rows) {
    const where = `sale ${s.id ?? '(no id)'}`;
    if (!s.id) { r.error(where, 'needs an id'); continue; }
    if (ids.has(s.id)) r.error(where, 'id is used twice');
    ids.add(s.id);
    const rec = refs.get(s.ref);
    if (!rec) r.error(where, `ref "${s.ref}" is not a record in data/references`);
    else if (s.variant && !(rec.variants ?? []).some((v) => v.name === s.variant)) r.error(where, `variant "${s.variant}" is not a generation of ${s.ref}`);
    if (!/^https:\/\//.test(s.url ?? '')) r.error(where, 'needs an https link to the sale or listing page');
    else if (urls.has(s.url)) r.error(where, 'the same link is logged twice');
    urls.add(s.url);
    if (!(s.price > 0)) r.error(where, 'price must be a positive number');
    if (!['sold', 'listed'].includes(s.kind)) r.error(where, 'kind must be sold or listed');
    if (!CURRENCIES.includes(s.currency)) r.error(where, `currency must be one of ${CURRENCIES.join(', ')}`);
    if (!String(s.title ?? '').trim()) r.error(where, 'needs a title');
    const date = new Date(s.date);
    if (Number.isNaN(+date)) r.error(where, 'date is not a date');
    else if (+date > today + day) r.error(where, 'date is in the future');
    if (s.kind === 'listed') {
      if (!s.checked) r.error(where, 'a listing needs `checked`, the date someone last saw it open');
      else if (Number.isNaN(+new Date(s.checked))) r.error(where, '`checked` is not a date');
      else if ((today - +new Date(s.checked)) / day > FRESH_DAYS) r.warn(where, `listing last checked ${String(s.checked).slice(0, 10)}; it is hidden on the site until re-checked or removed`);
    }
    if (s.kind === 'sold' && s.checked) r.warn(where, '`checked` is only used for listings');
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(checkSales().print() ? 0 : 1);
