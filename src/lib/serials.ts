// Case serial ranges, as recorded per generation (`serials` in a variant),
// turned into numbers the serial lookup can compare against.
//
// Ranges are written the way the sources print them: "626.7xx – 627.0xx",
// a single block "721.9xx", or an open end "1.263.4xx –". An x stands for
// any digit, so a block's low end fills the x's with 0 and its high end with 9.
import { leavesOf, formatYears, fullYears } from './site';

export interface SerialRange {
  lo: number;
  hi: number;
  text: string;
  name: string;
  path: string;
  years: string | null;
  dated: string | null;
  openEnd: boolean;
  // The citations behind this generation, serial range included.
  cites: { source: { id: string }; url: string; title: string }[];
}

const digits = (s: string) => s.replace(/[^0-9x]/gi, '').toLowerCase();

export function parseRange(text: string): { lo: number; hi: number; openEnd: boolean } | null {
  const [a, b] = text.split(/\s*[–-]\s*/);
  const start = digits(a ?? '');
  if (!start) return null;
  let end = digits(b ?? '');
  const openEnd = /[–-]\s*$/.test(text.trim());
  // An end written shorter than its start ("1.069.9xx – 1.070.9") is missing its x's.
  if (end && end.length < start.length) end = end.padEnd(start.length, 'x');
  if (!end) end = start;
  return { lo: Number(start.replace(/x/g, '0')), hi: Number(end.replace(/x/g, '9')), openEnd };
}

export function serialRanges(refs: any[]): SerialRange[] {
  const out: SerialRange[] = [];
  for (const ref of refs) {
    for (const leaf of leavesOf(ref)) {
      for (const text of leaf.variant?.serials ?? []) {
        const r = parseRange(text);
        if (!r) continue;
        out.push({ ...r, text, name: leaf.name, path: leaf.path, years: formatYears(leaf.years), dated: leaf.variant?.dated ? fullYears(leaf.variant.dated) : null, cites: (leaf.variant?.cites ?? []).map((id: string) => ref.data.citations.find((c: any) => c.id === id)).filter(Boolean) });
      }
    }
  }
  return out.sort((x, y) => x.lo - y.lo);
}
