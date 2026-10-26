// Collects the photos on a list of web pages (a dealer's listings, say) into
// incoming/<account>/posts.json, in the shape the Instagram scripts use, so
// download.mjs, sheets.mjs and place.mjs work on it. Each page becomes one
// "post" whose code is a short slug of its path; the page title and
// description stand in for the caption.
//   node scripts/web/pages.mjs <account> <url> [url ...]
//   node scripts/web/pages.mjs <account> --sitemap <sitemap-url> <match>
// Only images on the site's own CDN that look like photos (jpeg/png, not the
// logo) are kept: Squarespace pages by their image tags, Hostinger (Zyro)
// shop pages by the product's own `images` list in the page data (the page
// also carries every other product's thumbnail). Review every one before placing: pages also show straps,
// boxes and other watches.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const [account, ...args] = process.argv.slice(2);
if (!account || !args.length) { console.error('usage: pages.mjs <account> <url ...> | --sitemap <url> <match>'); process.exit(1); }

const get = async (u) => (await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
let urls = args;
if (args[0] === '--sitemap') {
  const xml = await get(args[1]);
  const match = new RegExp(args[2] ?? '.', 'i');
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => match.test(u));
}

const posts = [];
for (const url of urls) {
  const h = await get(url);
  const title = decode(h.match(/<title>([^<]*)/)?.[1] ?? '').replace(/\s+—.*$/, '').trim();
  const desc = decode(h.match(/property="og:description" content="([^"]*)"/)?.[1] ?? '');
  let imgs = [...new Set([...h.matchAll(/(?:data-src|data-image|src)="(https:\/\/images\.squarespace-cdn\.com\/[^"?]+\.(?:jpe?g|png))/gi)].map((m) => m[1]))]
    .filter((u) => !/logo/i.test(u));
  if (!imgs.length) {
    const d = decode(h);
    const at = d.indexOf('"images":[1,[');
    if (at >= 0) {
      const list = d.slice(at).match(/^"images":\[1,\[((?:,?\[0,\{"url":\[0,"[^"]+"\],"order":\[0,\d+\],"type":\[0,"image"\]\}\])+)/);
      if (list) imgs = [...list[1].matchAll(/"url":\[0,"([^"]+)"/g)].map((m) => m[1]);
    }
  }
  const code = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
  if (imgs.length) posts.push({ code, owner: new URL(url).host, time: null, url, title, caption: `${title}. ${desc}`.trim(), urls: imgs });
  await new Promise((r) => setTimeout(r, 800));
}
const dir = join(ROOT, 'incoming', account);
mkdirSync(dir, { recursive: true });
const out = join(dir, 'posts.json');
const prev = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
const by = new Map(prev.map((p) => [p.code, p]));
for (const p of posts) by.set(p.code, p);
writeFileSync(out, JSON.stringify([...by.values()], null, 1));
console.log(`${posts.length} pages, ${posts.reduce((n, p) => n + p.urls.length, 0)} photos -> ${out.replace(ROOT, '')}`);
