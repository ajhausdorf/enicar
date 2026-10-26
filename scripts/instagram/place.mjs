// Places identified photos on the site. Reads incoming/<account>/placements.json,
// makes a large and a small webp of each in public/images/<record>/, and
// appends its `images:` entry to data/references/<record>.yaml. Then remove the
// placed photos from data/pending-photos.yaml if they were there.
//   node scripts/instagram/place.mjs <account>
//
// placements.json is a list of:
//   { "rec": "sherpa-jet", "src": "<code>_<nn>", "variant": "MkII" | null,
//     "alt": "...", "caption": "..." | null,
//     "by": "dial" | "caption" | "tells" | "source", "note": "..." | null,
//     "view": "dial" | "caseback" | "movement" | "profile" | "other" }
// Credit, link and permission come from data/permissions.yaml (the entry whose
// profile_url is this account), so they can't be mistyped per photo.
// Photos collected from a website by scripts/web/pages.mjs (posts with a page
// `url`) are credited with the entry's `web.credit_as` and link to that page;
// <account> is then the folder under incoming/, and the entry is the one whose
// web.site is the page's host.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import YAML from 'yaml';

const ROOT = new URL('../../', import.meta.url).pathname;
const sharp = createRequire(join(ROOT, 'package.json'))('sharp');
const account = process.argv[2];
if (!account) { console.error('usage: place.mjs <account>'); process.exit(1); }

const perms = YAML.parse(readFileSync(join(ROOT, 'data/permissions.yaml'), 'utf8')) ?? [];
const postsFile = join(ROOT, 'incoming', account, 'posts.json');
const pages = new Map((existsSync(postsFile) ? JSON.parse(readFileSync(postsFile, 'utf8')) : []).filter((p) => p.url).map((p) => [p.code, p]));
const host = (u) => new URL(u).host.replace(/^www\./, '');
const webHost = pages.size ? host([...pages.values()][0].url) : null;
const perm = webHost
  ? perms.find((p) => p.web?.site && host(p.web.site) === webHost)
  : perms.find((p) => p.profile_url.replace(/\/$/, '').endsWith('/' + account));
if (!perm) { console.error(`no entry in data/permissions.yaml for ${webHost ?? account}; record their permission first`); process.exit(1); }
const placements = JSON.parse(readFileSync(join(ROOT, 'incoming', account, 'placements.json'), 'utf8'));
const prefix = perm.id.split('-').map((w) => w[0]).join('');
const q = (s) => JSON.stringify(s);

const byRec = {};
for (const x of placements) {
  const code = x.src.replace(/_\d\d$/, ''), n = Number(x.src.slice(-2));
  const page = pages.get(code);
  if (webHost && !page) { console.error(`${x.src}: no page for ${code} in posts.json`); process.exit(1); }
  const name = `${prefix}-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${n}`;
  const recFile = join(ROOT, 'data/references', x.rec + '.yaml');
  if (!existsSync(recFile)) { console.error(`no record ${x.rec}`); process.exit(1); }
  const dir = join(ROOT, 'public/images', x.rec);
  if (existsSync(join(dir, name + '.webp'))) { console.log('already placed', x.rec, x.src); continue; }
  mkdirSync(dir, { recursive: true });
  const base = sharp(join(ROOT, 'incoming', account, 'img', x.src + '.webp')).rotate();
  const large = await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(dir, name + '.webp'));
  await base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(dir, name + '-sm.webp'));
  (byRec[x.rec] ??= []).push(`  - file: /images/${x.rec}/${name}.webp
    thumb: /images/${x.rec}/${name}-sm.webp
    width: ${large.width}
    height: ${large.height}
    alt: ${q(x.alt)}
    view: ${x.view ?? 'dial'}
    variant: ${x.variant ? q(x.variant) : 'null'}
    source_url: ${page ? page.url : `https://www.instagram.com/p/${code}/`}
    credit: ${q(page ? perm.web.credit_as : perm.credit_as)}
    credit_url: ${page ? page.url : perm.link ?? perm.profile_url}
    license: "Used with permission"
    permission: granted
    permission_ref: ${perm.id}
    caption: ${x.caption ? q(x.caption) : 'null'}
    identified_by: ${x.by ?? 'dial'}
    identified_note: ${x.note ? q(x.note) : 'null'}`);
}

for (const [rec, list] of Object.entries(byRec)) {
  const p = join(ROOT, 'data/references', rec + '.yaml');
  let s = readFileSync(p, 'utf8');
  const m = s.match(/^images:(.*?)(?=^\S)/ms);
  if (!m) { console.error(`${rec}: no images: key to append to`); process.exit(1); }
  const old = m[1].replace(/^\n+|\n+$/g, '');
  const body = (old.trim() && old.trim() !== '[]' ? old + '\n' : '') + list.join('\n') + '\n';
  s = s.slice(0, m.index) + 'images:\n' + body + s.slice(m.index + m[0].length);
  writeFileSync(p, s);
  console.log(rec, '+', list.length);
}
console.log('Now: npm run check, then run the verify-facts skill on these photos before the PR.');
