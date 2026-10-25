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

// People who have let us publish their photos, and on what terms.
const permissions = defineCollection({
  loader: file('data/permissions.yaml'),
  schema: z.object({
    who: z.string(),
    profile_url: z.url(),
    granted: z.coerce.date(),
    via: z.string(),
    scope: z.string(),
    credit_as: z.string()
  })
});

// Publications, forums, archives. One entry per source, referenced by id
// from the citations on each watch record.
const sources = defineCollection({
  loader: file('data/sources.yaml'),
  schema: z.object({
    name: z.string(),
    kind: z.enum(['blog', 'forum', 'essay', 'interview', 'book', 'catalogue', 'auction', 'dealer', 'archive', 'commons', 'other']),
    // primary: research or period material. listing: a dealer or auction
    // description, useful for reference numbers but weaker evidence.
    tier: z.enum(['primary', 'secondary', 'listing']).default('secondary'),
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
// which fields of the record it supports (dotted paths, e.g. "movement.calibres").
const cites = z.array(z.string()).default([]);

const citation = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  source: reference('sources'),
  url: z.url(),
  title: z.string(),
  retrieved: isoDate,
  supports: z.array(z.string()).default([])
});


// Images live in public/images/<record id>/, made by scripts/images/add-image.mjs
// (a large and a small webp). Never hotlinked.
const image = z.object({
  file: z.string(),
  thumb: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  variant: z.string().nullable().default(null),
  source_url: z.url(),
  view: z.enum(['dial', 'caseback', 'movement', 'profile', 'advert', 'other']),
  credit: z.string(),
  credit_url: z.url().nullable().default(null),
  license: z.string(),
  permission: z.enum(['own', 'granted', 'cc', 'public-domain']),
  // Required when permission is 'granted': the entry in data/permissions.yaml.
  permission_ref: reference('permissions').nullable().default(null)
});

// Movements. One file per calibre in data/calibres/; watch records name
// calibres by `name`, and QA checks every name used has a file here.
const calibres = defineCollection({
  loader: glob({ pattern: '*.yaml', base: 'data/calibres' }),
  schema: z.object({
    name: z.string(),
    maker: z.string().nullable().default(null),
    winding: z.enum(['manual', 'automatic', 'quartz']).nullable().default(null),
    functions: z.array(z.string()).default([]),
    base: reference('calibres').nullable().default(null),
    base_note: z.string().nullable().default(null),
    introduced: z.string().nullable().default(null),
    notes: z.array(z.object({ text: z.string(), cites })).default([]),
    read_more: z.array(z.object({
      title: z.string(),
      url: z.url(),
      source: reference('sources'),
      note: z.string().nullable().default(null)
    })).default([]),
    status: z.enum(['draft', 'verified']),
    gaps: z.array(z.string()).default([]),
    citations: z.array(citation).default([]),
    last_reviewed: isoDate
  })
});

const references = defineCollection({
  loader: glob({ pattern: '*.yaml', base: 'data/references' }),
  schema: z.object({
    name: z.string(),
    family: reference('families'),
    // Factory reference numbers. Each needs its own citation, because they
    // usually come from listings rather than the main research source.
    references: z.array(z.object({
      number: z.string(),
      note: z.string().nullable().default(null),
      cites
    })).default([]),
    nicknames: z.array(z.string()).default([]),
    kind: z.enum(['chronograph', 'diver', 'gmt', 'dress', 'sport', 'alarm', 'other']),
    years: z.object({
      from: z.number().int().min(1913).max(1990).nullable().default(null),
      to: z.number().int().min(1913).max(1990).nullable().default(null),
      approximate: z.boolean().default(true)
    }).default({ from: null, to: null, approximate: true }),
    movement: z.object({
      calibres: z.array(z.string()).default([]),
      winding: z.enum(['manual', 'automatic', 'quartz']).nullable().default(null)
    }).default({ calibres: [], winding: null }),
    case: z.object({
      construction: z.string().nullable().default(null),
      material: z.string().nullable().default(null),
      diameter_mm: z.number().positive().nullable().default(null),
      lug_mm: z.number().positive().nullable().default(null),
      thickness_mm: z.number().positive().nullable().default(null)
    }).default({ construction: null, material: null, diameter_mm: null, lug_mm: null, thickness_mm: null }),
    dial: z.string().nullable().default(null),
    summary: z.string().nullable().default(null),
    history: z.array(z.object({ text: z.string(), cites })).default([]),
    // Generations or variants. Specs that differ between them live here,
    // covered by the variant's own cites.
    variants: z.array(z.object({
      name: z.string(),
      years: z.object({ from: z.number().int().nullable().default(null), to: z.number().int().nullable().default(null) }).default({ from: null, to: null }),
      tell: z.string(),
      diameter_mm: z.number().positive().nullable().default(null),
      lug_mm: z.number().positive().nullable().default(null),
      calibres: z.array(z.string()).default([]),
      case: z.string().nullable().default(null),
      hands: z.string().nullable().default(null),
      bezel: z.string().nullable().default(null),
      dials: z.array(z.string()).default([]),
      crowns: z.string().nullable().default(null),
      cites
    })).default([]),
    // Links out to the writing this record draws on. We link to the story
    // rather than retelling it.
    read_more: z.array(z.object({
      title: z.string(),
      url: z.url(),
      source: reference('sources'),
      note: z.string().nullable().default(null)
    })).default([]),
    images: z.array(image).default([]),
    // Photos we may not copy but can point to: a photographer's page or an
    // article where the watch is pictured. `variant` ties a link to one
    // generation; `cites` names the citation that attributes the photo.
    photos_elsewhere: z.array(z.object({
      variant: z.string().nullable().default(null),
      label: z.string(),
      url: z.url(),
      cites
    })).default([]),
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

export const collections = { families, sources, permissions, calibres, references };
