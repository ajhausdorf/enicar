// Add a photo to a record: fetch or read it, make a large and a small webp in
// public/images/<record>/, and print the `images:` entry to paste into the
// record. Credit, licence and permission are required up front so a photo can
// never land without them.
//
//   node scripts/images/add-image.mjs <record-id> <url-or-path> <name> \
//     --credit "EstrellaSuecia" --license "CC0" --permission cc \
//     --source-url <page the photo came from> --alt "..." [--view dial] [--variant MkII]
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../../', import.meta.url).pathname;
const [id, input, name, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i += 2) opts[rest[i].replace(/^--/, '')] = rest[i + 1];

const required = ['credit', 'license', 'permission', 'source-url', 'alt'];
const missing = required.filter((k) => !opts[k]);
if (!id || !input || !name || missing.length) {
  console.error(`usage: add-image.mjs <record-id> <url-or-path> <name> ${required.map((k) => `--${k} ...`).join(' ')}`);
  if (missing.length) console.error(`missing: ${missing.join(', ')}`);
  process.exit(1);
}
if (!['own', 'granted', 'cc', 'public-domain'].includes(opts.permission)) {
  console.error('--permission must be own, granted, cc or public-domain');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(name)) { console.error('<name> must be lower-case-with-hyphens'); process.exit(1); }
if (!existsSync(join(ROOT, 'data/references', `${id}.yaml`))) { console.error(`no record data/references/${id}.yaml`); process.exit(1); }

let buf;
if (/^https?:/.test(input)) {
  const res = await fetch(input, { headers: { 'user-agent': 'EnicarArchive/1.0 (image import)' } });
  if (!res.ok) { console.error(`download failed: ${res.status}`); process.exit(1); }
  buf = Buffer.from(await res.arrayBuffer());
} else {
  buf = readFileSync(input);
}

const dir = join(ROOT, 'public/images', id);
mkdirSync(dir, { recursive: true });
const base = sharp(buf).rotate();
const large = await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(dir, `${name}.webp`));
await base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(dir, `${name}-sm.webp`));

const q = (s) => JSON.stringify(s);
console.log(`  - file: /images/${id}/${name}.webp
    thumb: /images/${id}/${name}-sm.webp
    width: ${large.width}
    height: ${large.height}
    alt: ${q(opts.alt)}
    view: ${opts.view ?? 'dial'}
    variant: ${opts.variant ? q(opts.variant) : 'null'}
    source_url: ${opts['source-url']}
    credit: ${q(opts.credit)}
    credit_url: ${opts['credit-url'] ?? 'null'}
    license: ${q(opts.license)}
    permission: ${opts.permission}`);
