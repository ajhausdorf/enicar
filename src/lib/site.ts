// Site-wide settings and small helpers shared by pages.

export const SITE_NAME = 'Enicar Archive';

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
  family: (id: string) => `/?family=${id}`
};
