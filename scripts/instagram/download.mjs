// Downloads every photo in incoming/<account>/posts.json to
// incoming/<account>/img/<code>_<nn>.webp, pausing between requests.
// Instagram's photo URLs expire after a few days, so run this soon after
// export. Already-downloaded files are skipped.
//   node scripts/instagram/download.mjs <account>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const account = process.argv[2];
if (!account) { console.error('usage: download.mjs <account>'); process.exit(1); }
const dir = join(ROOT, 'incoming', account);
const posts = JSON.parse(readFileSync(join(dir, 'posts.json'), 'utf8'));
mkdirSync(join(dir, 'img'), { recursive: true });

let ok = 0, fail = 0;
for (const p of posts) {
  for (let i = 0; i < p.urls.length; i++) {
    const dest = join(dir, 'img', `${p.code}_${String(i + 1).padStart(2, '0')}.webp`);
    if (existsSync(dest)) { ok++; continue; }
    try {
      const res = await fetch(p.urls[i], { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(String(res.status));
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (e) {
      fail++; console.log('FAIL', p.code, i + 1, e.message, '(URL may have expired: re-run read-post.js on it)');
    }
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  }
}
console.log(`downloaded ${ok}, failed ${fail}`);
