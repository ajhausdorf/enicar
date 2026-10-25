// Run in the browser tool after reading posts. Returns everything in
// localStorage `__ig` as JSON, padded so the tool saves it to a file instead
// of printing it into the conversation. Feed that file to extract.mjs.
const s = JSON.parse(localStorage.getItem('__ig') || '{}');
JSON.stringify(Object.entries(s).map(([code, p]) => ({
  code,
  owner: (p.owners || [])[0] || null,
  time: p.time,
  caption: (p.caption.match(/: "([\s\S]*)"\.?\s*$/) || [, p.caption])[1],
  urls: p.urls
})).concat([{ pad: 'x'.repeat(60000) }]));
