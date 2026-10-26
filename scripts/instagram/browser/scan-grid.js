// Paste into the browser tool on a profile page (instagram.com/<account>/),
// signed in. Scrolls the whole grid at a person's pace and saves every post
// link with its image description (the caption) to localStorage under
// `__scan_<account>`. It keeps running after the tool call returns; check
// `localStorage.__scan_<account>_done` to know when it has finished, and
// `__scan_<account>_progress` for how far it has got.
//
// Instagram sometimes stops loading older posts for a while. A stall only
// counts posts seen in this run (a rerun starts at the top again, over posts
// already saved), waits longer, and nudges the page up and down before it
// gives up after 25 empty scrolls.
(async () => {
  const account = location.pathname.split('/').filter(Boolean)[0];
  const key = '__scan_' + account;
  const S = JSON.parse(localStorage.getItem(key) || '{}');
  const seen = new Set();
  const grab = () => document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((a) => {
    const h = a.getAttribute('href');
    seen.add(h);
    const img = a.querySelector('img');
    S[h] = img?.alt || S[h] || '';
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let stall = 0, last = 0;
  for (let i = 0; i < 1500 && stall < 25; i++) {
    grab();
    if (stall > 0 && stall % 3 === 0) { window.scrollBy(0, -1500); await sleep(1500); }
    window.scrollTo(0, document.body.scrollHeight);
    await sleep((stall ? 5000 : 2200) + Math.random() * 1500);
    grab();
    if (seen.size === last) stall++; else { stall = 0; last = seen.size; }
    localStorage.setItem(key, JSON.stringify(S));
    localStorage.setItem(key + '_progress', JSON.stringify({ i, session: seen.size, total: Object.keys(S).length, stall }));
  }
  localStorage.setItem(key + '_done', '1');
})();
