// Contact sheets for reviewing photos: labelled tiles, 12 to a sheet, in
// incoming/<account>/sheets/ (git-ignored). Read the sheets to identify
// watches cheaply, then open single photos at full size where the hands,
// GMT hand or bezel decide the generation.
//   node scripts/instagram/sheets.mjs <account> [file ...]   (default: all photos)
//   TILE=560 COLS=2 ROWS=2 node scripts/instagram/sheets.mjs <account> A_01 B_02 ...
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = new URL('../../', import.meta.url).pathname;
const sharp = createRequire(join(ROOT, 'package.json'))('sharp');
const [account, ...only] = process.argv.slice(2);
if (!account) { console.error('usage: sheets.mjs <account> [file ...]'); process.exit(1); }
const imgDir = join(ROOT, 'incoming', account, 'img');
const outDir = join(ROOT, 'incoming', account, 'sheets');
mkdirSync(outDir, { recursive: true });
const files = only.length ? only.map((f) => (f.endsWith('.webp') ? f : f + '.webp')) : readdirSync(imgDir).filter((f) => f.endsWith('.webp')).sort();
const T = Number(process.env.TILE || 300), C = Number(process.env.COLS || 4), R = Number(process.env.ROWS || 3), per = C * R;
const tag = only.length ? 'zoom' : 'sheet';

for (let s = 0; s * per < files.length; s++) {
  const batch = files.slice(s * per, (s + 1) * per);
  const comps = [];
  for (let i = 0; i < batch.length; i++) {
    const buf = await sharp(join(imgDir, batch[i])).resize(T, T, { fit: 'contain', background: '#ffffff' }).toBuffer();
    const x = (i % C) * T, y = Math.floor(i / C) * (T + 24);
    comps.push({ input: buf, left: x, top: y + 24 });
    const label = Buffer.from(`<svg width="${T}" height="24"><rect width="100%" height="100%" fill="#000"/><text x="6" y="17" font-family="Helvetica" font-size="15" fill="#fff">${batch[i].replace('.webp', '')}</text></svg>`);
    comps.push({ input: label, left: x, top: y });
  }
  const out = join(outDir, `${tag}${String(s + 1).padStart(2, '0')}.jpg`);
  await sharp({ create: { width: T * C, height: (T + 24) * R, channels: 3, background: '#ffffff' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
  console.log(out.replace(ROOT, ''), batch.length);
}
