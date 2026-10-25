// Live eBay listings through eBay's official Browse API (no scraping).
//
//   node scripts/prices/ebay.mjs search    find candidate listings for review
//   node scripts/prices/ebay.mjs recheck   re-check `listed` eBay entries in data/sales.yaml
//
// Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (an eBay developer "production"
// keyset) in the environment or in .env at the repo root, which git ignores.
//
// `search` writes incoming/prices/ebay-<date>.json: one row per listing with a
// guessed record. Nothing goes on the site from here: the update-prices skill
// reviews each candidate (right model, original, not a part or a redial) and
// adds the ones that pass to data/sales.yaml as `kind: listed`.
// `recheck` updates `checked` on listings that are still open and prints the
// ones that have ended, so they can be removed or logged as sold.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const API = 'https://api.ebay.com';
const MARKETS = ['EBAY_US', 'EBAY_GB', 'EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_NL'];
const WATCHES = '31387'; // eBay category: Wristwatches
const QUERIES = ['enicar sherpa', 'enicar graph', 'enicar ocean pearl', 'enicar seapearl', 'enicar star jewels'];

// Title keywords → record id, most specific first. A guess only; review decides.
const GUESS = [
  [/super[- ]?jet/i, 'sherpa-super-jet'], [/jet[- ]?graph/i, 'sherpa-jet-graph'], [/aqua[- ]?graph/i, 'sherpa-aqua-graph'],
  [/super[- ]?graph/i, 'sherpa-super-graph'], [/sherpa[- ]?graph/i, 'sherpa-graph'], [/super[- ]?divette/i, 'sherpa-super-divette'],
  [/divette/i, 'sherpa-divette'], [/super[- ]?dive/i, 'sherpa-super-dive'], [/ultra[- ]?dive/i, 'sherpa-ultradive'], [/\bops\b/i, 'sherpa-ops'],
  [/star[- ]?diver/i, 'sherpa-star-diver'], [/mini[- ]?dive/i, 'sherpa-mini-dive'], [/guide/i, 'sherpa-guide'], [/pilote/i, 'sherpa-pilote'],
  [/stewardess/i, 'sherpa-stewardess'], [/steward/i, 'sherpa-steward'], [/sherpa[- ]?jet|\bjet\b/i, 'sherpa-jet'], [/\bgmt\b/i, 'sherpa-gmt'],
  [/sherpa[- ]?dive\b/i, 'sherpa-dive'], [/sherpa[- ]?star/i, 'sherpa-star'], [/sherpa[- ]?date/i, 'sherpa-date'], [/ocean[- ]?pearl/i, 'ocean-pearl'],
  [/sea[- ]?pearl/i, 'seapearl'], [/star[- ]?jewels/i, 'star-jewels']
];

function env() {
  const e = { ...process.env };
  const f = join(ROOT, '.env');
  if (existsSync(f)) for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !e[m[1]]) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!e.EBAY_CLIENT_ID || !e.EBAY_CLIENT_SECRET) {
    console.error('Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (in .env at the repo root, which git ignores).');
    process.exit(1);
  }
  return e;
}

async function token(e) {
  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${e.EBAY_CLIENT_ID}:${e.EBAY_CLIENT_SECRET}`).toString('base64') },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope')
  });
  if (!res.ok) throw new Error(`eBay token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const call = async (tok, path, market) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${tok}`, 'X-EBAY-C-MARKETPLACE-ID': market } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`eBay ${path}: ${res.status} ${await res.text()}`);
  return res.json();
};
const pause = () => new Promise((r) => setTimeout(r, 300));
const today = () => new Date().toISOString().slice(0, 10);

async function search() {
  const tok = await token(env());
  const seen = new Map();
  for (const market of MARKETS) for (const q of QUERIES) {
    const data = await call(tok, `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&category_ids=${WATCHES}&limit=200`, market);
    for (const it of data?.itemSummaries ?? []) {
      if (seen.has(it.legacyItemId ?? it.itemId) || !/enicar/i.test(it.title)) continue;
      seen.set(it.legacyItemId ?? it.itemId, {
        market, title: it.title, price: Number(it.price?.value), currency: it.price?.currency,
        url: (it.itemWebUrl ?? '').split('?')[0], condition: it.condition ?? null, buying: it.buyingOptions ?? [],
        listed: it.itemCreationDate?.slice(0, 10) ?? null, image: it.image?.imageUrl ?? null,
        guess: GUESS.find(([re]) => re.test(it.title))?.[1] ?? null
      });
    }
    await pause();
  }
  const dir = join(ROOT, 'incoming/prices');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `ebay-${today()}.json`);
  const rows = [...seen.values()].sort((a, b) => String(a.guess).localeCompare(String(b.guess)));
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`${rows.length} Enicar listings, ${rows.filter((r) => r.guess).length} with a guessed record -> ${out.replace(ROOT, '')}`);
  console.log('Review them with the update-prices skill; nothing has been added to the site.');
}

async function recheck() {
  const tok = await token(env());
  const p = join(ROOT, 'data/sales.yaml');
  let s = readFileSync(p, 'utf8');
  const blocks = [...s.matchAll(/^- id: (\S+)\n(?: {2}.*\n)+/gm)];
  let open = 0, ended = [];
  for (const b of blocks) {
    if (!/\n {2}kind: listed\n/.test(b[0]) || !/\n {2}url: https:\/\/www\.ebay\.[^/]+\/itm\/(\d+)/.test(b[0])) continue;
    const id = b[0].match(/\/itm\/(\d+)/)[1];
    const item = await call(tok, `/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${id}`, 'EBAY_US');
    const live = item && !item.itemEndDate || (item?.itemEndDate && new Date(item.itemEndDate) > new Date());
    if (live) {
      s = s.replace(b[0], b[0].replace(/\n {2}checked: .*\n/, `\n  checked: ${today()}\n`));
      open++;
    } else ended.push(b[1]);
    await pause();
  }
  writeFileSync(p, s);
  console.log(`${open} eBay listings still open (checked dates updated).`);
  if (ended.length) console.log(`Ended, remove or log as sold if the result is public: ${ended.join(', ')}`);
}

const cmd = process.argv[2];
if (cmd === 'search') await search();
else if (cmd === 'recheck') await recheck();
else { console.error('usage: ebay.mjs search | recheck'); process.exit(1); }
