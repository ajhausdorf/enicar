// Run in the browser tool on a single post page (instagram.com/p/<code>/),
// signed in, after waiting ~4 s for it to load. Steps through a carousel,
// collects the full-size URL of every photo in the post (not the "More posts"
// strip below it), the caption, date and the posting account, and adds them
// to localStorage `__ig`. Returns a one-line summary.
//
// Store it once:  localStorage.setItem('__read_post', <this file's text>)
// Then per post:  await (new Function('return (async () => {' + localStorage.getItem('__read_post') + '})()'))()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = location.pathname.split('/').filter(Boolean).pop();
// The "More posts from <account>" heading marks where the post ends; it also
// names the account that actually posted it (collab posts show on both grids).
const mc = [...document.querySelectorAll('main *')].filter((e) => (e.textContent || '').trim().startsWith('More posts from'));
const more = mc[mc.length - 1];
const before = (el) => !more || (el.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING);
const best = (i) => {
  const c = (i.srcset || '').split(',').map((s) => s.trim().split(' ')).filter((p) => p[0]);
  c.sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
  return c[0]?.[0] || i.currentSrc;
};
const seen = new Map();
const grab = () => document.querySelectorAll('main img').forEach((i) => {
  if (before(i) && i.naturalWidth >= 300) {
    const k = i.currentSrc.split('?')[0].split('/').pop();
    if (!seen.has(k)) seen.set(k, best(i));
  }
});
grab();
for (let n = 0; n < 25; n++) {
  // Carousel arrows are icons inside unlabelled buttons.
  const nx = [...document.querySelectorAll('main [aria-label="Next"]')].map((e) => e.closest('button') || e).find(before);
  if (!nx) break;
  nx.click(); await sleep(900); grab();
}
const og = document.querySelector('meta[property="og:description"]')?.content || '';
const capEl = [...document.querySelectorAll('main h1')].find(before);
const caption = capEl?.innerText || og;
const time = [...document.querySelectorAll('main time[datetime]')].find(before)?.getAttribute('datetime');
const isVideo = !!document.querySelector('main video') && seen.size === 0;
const urls = [...seen.values()];
const owners = [(more?.textContent || '').replace('More posts from', '').trim()];
const store = JSON.parse(localStorage.getItem('__ig') || '{}');
store[code] = { time, caption, urls, isVideo, owners };
localStorage.setItem('__ig', JSON.stringify(store));
const q = (caption.match(/: "([\s\S]*)"\.?\s*$/) || [, caption])[1];
return code + ' | ' + owners.join('+') + ' | ' + urls.length + ' | ' + (time || '').slice(0, 10) + ' | ' + q.replace(/\s+/g, ' ').slice(0, 170);
