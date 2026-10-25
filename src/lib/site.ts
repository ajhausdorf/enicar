// Site-wide settings and small helpers shared by pages.

export const SITE_NAME = 'Enicar World';

// Where corrections and submissions go. The repo is private for now, so the
// public can't open issues yet; switch this to an email or a public repo
// before launch (see CLAUDE.md, "Before launch").
export const CONTRIBUTE_URL = 'https://github.com/ajhausdorf/enicar/issues/new/choose';

export const KIND_LABEL: Record<string, string> = {
  chronograph: 'Chronograph',
  diver: 'Diver',
  gmt: 'GMT',
  dress: 'Dress',
  sport: 'Sport',
  alarm: 'Alarm',
  other: 'Other'
};

type Years = { from: number | null; to: number | null; approximate: boolean };

export function formatYears(y: Years): string | null {
  if (y.from == null && y.to == null) return null;
  const c = y.approximate ? 'c. ' : '';
  if (y.from != null && y.to != null) return y.from === y.to ? `${c}${y.from}` : `${c}${y.from} to ${y.to}`;
  return y.from != null ? `${c}${y.from} onward` : `until ${c}${y.to}`;
}

export function decadeOf(y: Years): string | null {
  const year = y.from ?? y.to;
  return year == null ? null : `${Math.floor(year / 10) * 10}s`;
}

const CURRENCY: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ' };
export function formatRange(b: { currency: string; low: number; high: number }): string {
  const s = CURRENCY[b.currency] ?? `${b.currency} `;
  const n = (v: number) => v.toLocaleString('en-GB');
  return `${s}${n(b.low)} to ${n(b.high)}`;
}

export const href = {
  ref: (id: string) => `/ref/${id}/`,
  family: (id: string) => `/?family=${id}`,
  calibre: (name: string) => `/calibres/${calibreId(name)}/`
};

// Calibre names as written in records ("AR1126", "Valjoux 72") map to the
// file names in data/calibres/ ("ar1126", "valjoux-72").
export const calibreId = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type RefLike = { id: string; data: { movement: { calibres: string[] }; variants: { name: string; calibres: string[] }[] } };

// Which watches use each calibre, and in which generations.
export function calibreUsage<T extends RefLike>(refs: T[]) {
  const use = new Map<string, { ref: T; variants: string[] }[]>();
  for (const r of refs) {
    const ids = new Set(r.data.movement.calibres.map(calibreId));
    for (const v of r.data.variants) for (const c of v.calibres) ids.add(calibreId(c));
    for (const id of ids) {
      const variants = r.data.variants.filter((v) => v.calibres.some((c) => calibreId(c) === id)).map((v) => v.name);
      use.set(id, [...(use.get(id) ?? []), { ref: r, variants }]);
    }
  }
  return use;
}
