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

const CURRENCY: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF ', HKD: 'HK$', SEK: 'SEK ', JPY: '¥' };
export function formatPrice(currency: string, v: number): string {
  return `${CURRENCY[currency] ?? `${currency} `}${v.toLocaleString('en-GB')}`;
}
export function formatRange(currency: string, b: { low: number | null; high: number }): string {
  return b.low == null ? `up to ${formatPrice(currency, b.high)}` : `${formatPrice(currency, b.low)} to ${b.high.toLocaleString('en-GB')}`;
}
// The price guide that applies to a catalog leaf: its generation's own, or the record's.
export function barometerOf(leaf: { ref: any; variant?: any }) {
  return leaf.variant?.barometer ?? leaf.ref.data.barometer ?? null;
}
// US dollars per unit, set by hand (mid-market, from XE and Bloomberg on the
// date below). The "USD" toggle converts with these; update both together.
export const USD_RATES = {
  asOf: '2026-10-25',
  rates: { USD: 1, EUR: 1.1203, CHF: 1.212, GBP: 1.3377, HKD: 0.1275, SEK: 0.1007, JPY: 0.00638 } as Record<string, number>
};
export const toUsd = (currency: string, v: number) => v * (USD_RATES.rates[currency] ?? NaN);
// Listings count as current for this long after they were last checked.
export const LISTING_FRESH_DAYS = 21;

export const href = {
  family: (id: string) => `/?family=${id}`,
  model: (familyId: string, refId: string) => `/?family=${familyId}&model=${refId}`,
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

// The catalog has three levels: family (Sherpa), model (Sherpa Jet, one
// record in data/references/) and generation (MkI, a variant on the record).
// Only the bottom level gets a page. A model with no generations is its own
// bottom level. leavesOf() turns a record into those pages.
type Years = { from: number | null; to: number | null };
type VariantLike = { name: string; years: Years; calibres: string[] };
type ImageLike = { variant: string | null };
type RecordLike = {
  id: string;
  data: {
    name: string;
    years: Years & { approximate: boolean };
    movement: { calibres: string[] };
    variants: VariantLike[];
    images: ImageLike[];
  };
};

export const slugify = calibreId;

// Production dates are recorded as the sources print them ("6/66"); show
// the year in full ("6/1966"). Every Enicar date here is in the 1900s.
export const fullYears = (s: string) => s.replace(/\b(\d{1,2})\/(\d{2})\b/g, '$1/19$2');

export function leavesOf<R extends RecordLike>(ref: R) {
  const d = ref.data;
  if (!d.variants.length) {
    return [{ ref, variant: null, path: `/ref/${ref.id}/`, slug: ref.id, name: d.name, years: d.years, calibres: d.movement.calibres, images: d.images }];
  }
  return d.variants.map((v) => ({
    ref,
    variant: v as R['data']['variants'][number],
    path: `/ref/${ref.id}/${slugify(v.name)}/`,
    slug: `${ref.id}/${slugify(v.name)}`,
    name: `${d.name} ${v.name}`,
    years: { ...v.years, approximate: d.years.approximate },
    calibres: v.calibres.length ? v.calibres : d.movement.calibres,
    // A photo tagged with a generation shows on that generation; untagged ones show on all.
    images: d.images.filter((i) => !i.variant || i.variant === v.name) as R['data']['images']
  }));
}

export type Leaf<R extends RecordLike> = ReturnType<typeof leavesOf<R>>[number];

// A calibre's photos: its own, then movement photos from watch pages whose
// watch (or generation) uses this calibre and no other, so the movement shown
// can only be this one. On a model with generations the photo must be tagged
// with one, or it could be another generation's movement.
export function calibrePhotos(calibre: { id: string; data: { images: any[] } }, refs: any[]) {
  const fromWatches = refs.flatMap((r) => leavesOf(r)
    .filter((l) => l.calibres.length === 1 && calibreId(l.calibres[0]) === calibre.id)
    .flatMap((l) => (l.images as any[]).filter((i) => i.view === 'movement' && (!l.ref.data.variants.length || i.variant)).map((i) => ({ ...i, from: { name: l.name, path: l.path } }))));
  const seen = new Set<string>();
  return [...calibre.data.images, ...fromWatches].filter((i: any) => !seen.has(i.file) && seen.add(i.file));
}

// The watch pages that use a calibre, one per generation where the record has them.
export const calibreWatches = (usage: { ref: any; variants: string[] }[]) => usage.flatMap((u) => u.variants.length
  ? u.variants.map((v) => ({ name: `${u.ref.data.name} ${v}`, path: `/ref/${u.ref.id}/${slugify(v)}/` }))
  : [{ name: u.ref.data.name, path: leavesOf(u.ref)[0].path }]);

export const WINDING: Record<string, string> = { manual: 'Hand-wound', automatic: 'Automatic', electric: 'Electric (battery)', quartz: 'Quartz' };

// Ranfft's archive has photos of most calibres; link there when we have none.
export const ranfftUrl = (calibre: { data: { citations: { source: { id: string }; url: string }[] } }) =>
  calibre.data.citations.find((c) => c.source.id === 'ranfft')?.url ?? null;
