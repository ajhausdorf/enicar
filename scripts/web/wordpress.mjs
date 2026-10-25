// Collects the photos in a photographer's WordPress articles into
// incoming/<account>/posts.json, in the same shape the Instagram scripts use,
// so download.mjs, sheets.mjs and place.mjs work on it unchanged.
//   node scripts/web/wordpress.mjs <account>      (account: e.g. enicar-org)
//
// The site comes from data/permissions.yaml (the entry whose web.site host
// matches the account). Each article becomes one "post" whose code is
// p<article id>; its title stands in for the caption. Photos that aren't the
// photographer's to give are left out here, with the reason, in
// incoming/<account>/skipped.json:
//   - articles about auction results, other collectors, ads, logos, archive
//     documents and press, the book, or another brand's new watches
//   - screenshots
//   - photos whose caption, alt text or the text right after them credits
//     someone or somewhere else, and articles built on another collector's
//     photos
// What's left still needs a look: ads and catalogue pages without a caption
// get caught on the contact sheets and go to `excluded`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

const ROOT = new URL('../../', import.meta.url).pathname;
const account = process.argv[2];
if (!account) { console.error('usage: wordpress.mjs <account>'); process.exit(1); }
const perm = (YAML.parse(readFileSync(join(ROOT, 'data/permissions.yaml'), 'utf8')) ?? [])
  .find((p) => p.web && new URL(p.web.site).host.replace(/\./g, '-') === account);
if (!perm) { console.error(`no permission with a web.site for ${account}`); process.exit(1); }
const site = perm.web.site.replace(/\/$/, '');

const SKIP_ARTICLE = /barometer|meet the collectors|advertising|trademark|signs of saturn|auction|catalogues|letters from the past|newspapers|magazines|book|kickstarter|interview|podcast|title fight|if they would have worn|sherpa watches brings back|scams|expo|evening with/i;
const CREDITS = /photo ?credit|courtesy|credit:|source:|©|copyright|posted by|@[a-z0-9_.]{3,}|auction|sold (at|for|on)|fetched|chrono24|ebay|catawiki|phillips|christie|sotheby|europa star|catalog(ue)?|advert|brochure|\bad\b|screenshot|for sale|available (on|at)/i;
// Articles built on another collector's photos.
const OTHERS_ARTICLE = /legacy of gvm|swiss police super-dives/i;
// Credits written in the text just after a photo ("Pics: @someone").
const CREDIT_AFTER = /photo ?credit|photo'?s?:|pics?:|picture:|courtesy|found (on|at)|taken from a brochure|@[a-z0-9_.]{3,}|https?:\/\//i;
const SCREENSHOT = /scherm|screen ?shot|schermafbeelding/i;
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;/g, '‘').replace(/&#8220;|&#8221;/g, '"').replace(/&amp;/g, '&').replace(/&#8211;/g, '–').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const full = (u) => u.split('?')[0].replace(/-\d+x\d+(?=\.\w+$)/, '').replace(/-scaled(?=\.\w+$)/, '');

async function all(type) {
  const out = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${site}/wp-json/wp/v2/${type}?per_page=50&page=${page}&_fields=id,date,link,title,content`);
    if (!res.ok) break;
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 50) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return out;
}

const articles = [...await all('posts'), ...await all('pages')];
const posts = [], skipped = [];
for (const a of articles) {
  const title = text(a.title.rendered);
  const html = a.content.rendered;
  // Each <img>, with the figcaption of the figure it sits in, if any.
  const found = [];
  for (const m of html.matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>|<img[^>]+>/g)) {
    const block = m[0];
    const rest = html.slice(m.index + block.length);
    const after = text(rest.slice(0, rest.search(/<figure|<img|$/))).slice(0, 250);
    const cap = text(block.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '');
    for (const img of block.matchAll(/<img[^>]+>/g)) {
      const src = img[0].match(/(?:data-orig-file|src)="([^"]+)"/)?.[1];
      if (!src || !/\/wp-content\/uploads\//.test(src)) continue;
      found.push({ url: full(src), alt: text(img[0].match(/alt="([^"]*)"/)?.[1] ?? ''), caption: cap, after });
    }
  }
  const seen = new Set(), keep = [];
  for (const f of found) {
    if (seen.has(f.url)) continue;
    seen.add(f.url);
    const why = SKIP_ARTICLE.test(title) ? `article "${title}" is about auctions, collectors, ads, archives, press or the book`
      : OTHERS_ARTICLE.test(title) ? `article "${title}" shows another collector's watches and photos`
      : SCREENSHOT.test(f.url) ? 'screenshot'
      : CREDITS.test(`${f.caption} ${f.alt}`) ? `caption credits someone or somewhere else: "${f.caption || f.alt}"`
      : CREDIT_AFTER.test(f.after) ? `text after the photo credits someone or somewhere else: "${f.after.slice(0, 120)}"`
      : null;
    if (why) skipped.push({ article: a.link, url: f.url, reason: why });
    else keep.push(f);
  }
  if (!keep.length) continue;
  posts.push({
    code: `p${a.id}`, owner: new URL(site).host, time: a.date, url: a.link, title,
    caption: title, urls: keep.map((f) => f.url),
    photos: keep.map((f, i) => ({ n: i + 1, alt: f.alt || null, caption: f.caption || null, after: f.after || null }))
  });
}

const dir = join(ROOT, 'incoming', account);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'posts.json'), JSON.stringify(posts, null, 1));
writeFileSync(join(dir, 'skipped.json'), JSON.stringify(skipped, null, 1));
console.log(`${articles.length} articles; ${posts.length} with photos to review, ${posts.reduce((n, p) => n + p.urls.length, 0)} photos; ${skipped.length} skipped (see skipped.json)`);
