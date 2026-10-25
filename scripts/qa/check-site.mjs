// Checks the built site in dist/ rather than the data: every record has a
// page, the key pages exist and say what they should, internal links resolve,
// and the search index was built. Run after `npm run build`.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadReferences, Report, ROOT } from './lib.mjs';

const DIST = join(ROOT, 'dist');

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'pagefind' ? [] : htmlFiles(p)) : f.endsWith('.html') ? [p] : [];
  });
}

const decode = (html) => html.replace(/&(amp|quot|#34|#39|lt|gt);/g, (_, e) => ({ amp: '&', quot: '"', '#34': '"', '#39': "'", lt: '<', gt: '>' })[e]);

function resolves(urlPath) {
  const clean = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  const p = join(DIST, clean);
  return existsSync(p) && (statSync(p).isFile() || existsSync(join(p, 'index.html')));
}

export function checkSite() {
  const r = new Report('built site');
  if (!existsSync(DIST)) { r.error('dist', 'not built; run npm run build first'); return r; }

  const refs = loadReferences();
  for (const { id, data } of refs) {
    const page = join(DIST, 'ref', id, 'index.html');
    if (!existsSync(page)) { r.error(`/ref/${id}/`, 'page missing'); continue; }
    const html = decode(readFileSync(page, 'utf8'));
    if (!html.includes(data.name)) r.error(`/ref/${id}/`, `page does not show the record name "${data.name}"`);
    if (data.status === 'draft' && !html.includes('Draft record.')) r.error(`/ref/${id}/`, 'draft record is missing its draft notice');
  }

  const index = existsSync(join(DIST, 'index.html')) ? readFileSync(join(DIST, 'index.html'), 'utf8') : '';
  const cards = (index.match(/class="watch-card"/g) ?? []).length;
  if (cards !== refs.length) r.error('/', `catalog shows ${cards} cards but there are ${refs.length} records`);

  for (const page of ['sources', 'coverage', 'calibres', 'search']) {
    if (!existsSync(join(DIST, page, 'index.html'))) r.error(`/${page}/`, 'page missing');
  }
  if (!existsSync(join(DIST, 'pagefind', 'pagefind-ui.js'))) r.error('search', 'Pagefind index missing; the build must run pagefind');

  for (const file of htmlFiles(DIST)) {
    const html = readFileSync(file, 'utf8');
    const where = '/' + relative(DIST, file).replace(/index\.html$/, '');
    for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
      if (href.startsWith('//') || href.startsWith('/pagefind/')) continue;
      if (!resolves(href)) r.error(where, `broken internal link ${href}`);
    }
    for (const [, src] of html.matchAll(/<img[^>]+src="(\/[^"]*)"/g)) {
      if (!resolves(src)) r.error(where, `missing image ${src}`);
    }
    if (/\[(confirm|tbc|todo|low|high|date|price)\]/i.test(html)) r.error(where, 'placeholder text rendered on the page');
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(checkSite().print() ? 0 : 1);
