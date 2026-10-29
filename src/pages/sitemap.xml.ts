// Every page on the site, for crawlers. Search results and the 404
// page are left out; they carry noindex.
import { getCollection } from 'astro:content';
import { leavesOf } from '../lib/site';

export async function GET({ site }: { site: URL }) {
  const refs = await getCollection('references');
  const calibres = await getCollection('calibres');
  const paths = [
    '/', '/calibres/', '/serial/', '/sources/',
    ...refs.flatMap((r) => leavesOf(r).map((l) => l.path)),
    ...calibres.map((c) => `/calibres/${c.id}/`)
  ];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' }
  });
}
