// Paste into the browser tool on a profile page (instagram.com/<account>/),
// signed in. Scrolls the whole grid at a person's pace and saves every post
// link with its image description (the caption) to localStorage under
// `__scan_<account>`. It keeps running after the tool call returns; check
// `localStorage.__scan_<account>_done` to know when it has finished.
(async () => {
  const account = location.pathname.split('/').filter(Boolean)[0];
  const key = '__scan_' + account;
  const S = JSON.parse(localStorage.getItem(key) || '{}');
  const grab = () => document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach((a) => {
    const img = a.querySelector('img');
    S[a.getAttribute('href')] = img?.alt || S[a.getAttribute('href')] || '';
  });
  let stable = 0, last = 0;
  for (let i = 0; i < 400 && stable < 6; i++) {
    grab();
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 900));
    grab();
    const n = Object.keys(S).length;
    if (n === last) stable++; else { stable = 0; last = n; }
    localStorage.setItem(key, JSON.stringify(S));
  }
  localStorage.setItem(key + '_done', '1');
})();
