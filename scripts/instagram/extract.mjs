// Turns the file the browser tool saved from export.js into
// incoming/<account>/posts.json.
//   node scripts/instagram/extract.mjs <saved-tool-output.txt> <account>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const [file, account] = process.argv.slice(2);
if (!file || !account) { console.error('usage: extract.mjs <saved-tool-output.txt> <account>'); process.exit(1); }

const raw = JSON.parse(readFileSync(file, 'utf8'));
const text = raw.map((x) => x.text ?? '').join('');
const s = text.slice(text.indexOf('[{'), text.lastIndexOf('}]') + 2);
let data;
try { data = JSON.parse(s); } catch { data = JSON.parse(JSON.parse('"' + s + '"')); }
const posts = data.filter((p) => p.code);

const dir = join(ROOT, 'incoming', account);
mkdirSync(dir, { recursive: true });
const out = join(dir, 'posts.json');
// Merge with anything already extracted for this account.
let prev = [];
try { prev = JSON.parse(readFileSync(out, 'utf8')); } catch {}
const byCode = new Map(prev.map((p) => [p.code, p]));
for (const p of posts) byCode.set(p.code, p);
writeFileSync(out, JSON.stringify([...byCode.values()], null, 1));
const owners = {};
for (const p of posts) owners[p.owner ?? '?'] = (owners[p.owner ?? '?'] ?? 0) + 1;
console.log(`${posts.length} posts, ${posts.reduce((n, p) => n + p.urls.length, 0)} photos -> ${out}`);
console.log('posted by:', owners, '(collab posts by other accounts are not covered by this account\'s permission)');
