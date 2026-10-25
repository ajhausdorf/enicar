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
