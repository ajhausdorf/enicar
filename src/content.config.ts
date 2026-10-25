// The data schema. Every watch record in data/references/*.yaml is validated
// against this at build time; a record that doesn't fit fails the build.
// Editorial rules that a schema can't express (source coverage for verified
// records, no placeholder text) live in scripts/qa/check-sources.mjs.
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const isoDate = z.coerce.date();

const families = defineCollection({
  loader: file('data/families.yaml'),
  schema: z.object({
    name: z.string(),
    summary: z.string().nullable().default(null),
    order: z.number().int()
  })
});

// Publications, forums, archives. One entry per source, referenced by id
// from the citations on each watch record.
const sources = defineCollection({
  loader: file('data/sources.yaml'),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['blog', 'forum', 'essay', 'interview', 'book', 'catalogue', 'auction', 'archive', 'other']),
    url: z.url(),
    author: z.string().nullable().default(null),
    // confirmed: we have checked who runs it and that the URL is right.
    status: z.enum(['confirmed', 'to-confirm']),
    what: z.string(),
    use: z.string().nullable().default(null),
    leads_to: z.array(z.string()).default([]),
    permission: z.enum(['granted', 'requested', 'not-asked', 'not-needed']).default('not-asked')
  })
});

// A citation on a record: which source, the exact page, when we read it, and
// which fields of the record it supports (dotted paths, e.g. "movement.calibre").
const citation = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  source: reference('sources'),
  url: z.url(),
  title: z.string(),
  retrieved: isoDate,
  supports: z.array(z.string()).default([])
});

const cited = z.array(z.string()).default([]);

const image = z.object({
  file: z.string(),
  alt: z.string(),
  view: z.enum(['dial', 'caseback', 'movement', 'profile', 'advert', 'other']),
  credit: z.string(),
  credit_url: z.url().nullable().default(null),
  license: z.string(),
  permission: z.enum(['own', 'granted', 'cc', 'public-domain'])
});

const references = defineCollection({
  loader: glob({ pattern: '*.yaml', base: 'data/references' }),
  schema: z.object({
    name: z.string(),
    family: reference('families'),
    reference: z.string().nullable().default(null),
    nicknames: z.array(z.string()).default([]),
    kind: z.enum(['chronograph', 'diver', 'gmt', 'dress', 'sport', 'alarm', 'other']),
    years: z.object({
      from: z.number().int().min(1913).max(1990).nullable().default(null),
      to: z.number().int().min(1913).max(1990).nullable().default(null),
      approximate: z.boolean().default(true)
    }).default({ from: null, to: null, approximate: true }),
    movement: z.object({
      calibre: z.string().nullable().default(null),
      winding: z.enum(['manual', 'automatic', 'quartz']).nullable().default(null)
    }).default({ calibre: null, winding: null }),
    case: z.object({
      construction: z.string().nullable().default(null),
      material: z.string().nullable().default(null),
      diameter_mm: z.number().positive().nullable().default(null)
    }).default({ construction: null, material: null, diameter_mm: null }),
    dial: z.string().nullable().default(null),
    summary: z.string().nullable().default(null),
    history: z.array(z.object({ text: z.string(), cites: cited })).default([]),
    variants: z.array(z.object({
      name: z.string(),
      years: z.string().nullable().default(null),
      tell: z.string(),
      cites: cited
    })).default([]),
    images: z.array(image).default([]),
    barometer: z.object({
      currency: z.enum(['EUR', 'USD', 'GBP', 'CHF']),
      low: z.number().nonnegative(),
      high: z.number().nonnegative(),
      condition: z.string(),
      edition: z.string(),
      cite: z.string()
    }).nullable().default(null),
    // draft: work in progress, may have gaps, shown with a Draft badge.
    // verified: every populated fact is covered by a citation (enforced by QA).
    status: z.enum(['draft', 'verified']),
    gaps: z.array(z.string()).default([]),
    citations: z.array(citation).default([]),
    last_reviewed: isoDate
  })
});

export const collections = { families, sources, references };
