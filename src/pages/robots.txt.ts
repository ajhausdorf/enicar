// Search results and the 404 page keep themselves out with a noindex tag,
// which crawlers can only see if they're allowed to fetch the page.
export function GET({ site }: { site: URL }) {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
