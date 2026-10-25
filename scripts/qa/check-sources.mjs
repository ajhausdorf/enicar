// Editorial rules the schema can't express.
//
// Every record:
//   - citations have unique ids and point at a known source
//   - history, variant and barometer cites point at a citation on the record
//   - images exist on disk and carry credit, licence and permission
//   - no placeholder text like "[confirm]" or "TODO" in any field
// Verified records, additionally:
//   - every populated fact field is listed in some citation's `supports`
//   - every history paragraph and variant cites at least one citation
//   - no open gaps
import { loadReferences, loadSources, get, isPopulated, Report, existsSync, join, ROOT } from './lib.mjs';

// Fact fields that must be backed by a citation once a record is verified.
export const FACT_FIELDS = [
  'reference', 'nicknames', 'years.from', 'years.to', 'movement.calibre', 'movement.winding',
  'case.construction', 'case.material', 'case.diameter_mm', 'dial'
];

const PLACEHOLDER = /\[(confirm|tbc|tbd|todo|source|date|price|ref|low|high|n|edition)[^\]]*\]|\bTODO\b|\bTBC\b|lorem ipsum/i;

function walkStrings(value, path, fn) {
  if (typeof value === 'string') fn(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, fn));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, fn);
}

export function checkSources() {
  const r = new Report('sources and citations');
  const sourceIds = new Set(loadSources().map((s) => s.id));

  for (const { id, file, data: d } of loadReferences()) {
    const where = file;
    const citations = d.citations ?? [];
    const citeIds = new Set();
    for (const c of citations) {
      if (citeIds.has(c.id)) r.error(where, `duplicate citation id "${c.id}"`);
      citeIds.add(c.id);
      if (!sourceIds.has(c.source)) r.error(where, `citation "${c.id}" points at unknown source "${c.source}" (add it to data/sources.yaml)`);
      if (!c.url || !c.retrieved) r.error(where, `citation "${c.id}" needs both url and retrieved date`);
      for (const f of c.supports ?? []) {
        if (!FACT_FIELDS.includes(f)) r.error(where, `citation "${c.id}" supports unknown field "${f}" (allowed: ${FACT_FIELDS.join(', ')})`);
      }
    }

    const checkCites = (list, label) => {
      for (const cid of list ?? []) if (!citeIds.has(cid)) r.error(where, `${label} cites "${cid}", which is not a citation on this record`);
    };
    (d.history ?? []).forEach((p, i) => checkCites(p.cites, `history[${i}]`));
    (d.variants ?? []).forEach((v, i) => checkCites(v.cites, `variant "${v.name}"`));
    if (d.barometer) checkCites([d.barometer.cite], 'barometer');

    for (const [i, img] of (d.images ?? []).entries()) {
      if (!img.credit || !img.license || !img.permission) r.error(where, `images[${i}] needs credit, license and permission`);
      if (img.file && img.file.startsWith('/') && !existsSync(join(ROOT, 'public', img.file))) r.error(where, `images[${i}] file ${img.file} not found under public/`);
      if (img.file && /^https?:/.test(img.file)) r.error(where, `images[${i}] must be a local file under public/images, not a hotlink`);
    }

    walkStrings(d, '', (path, s) => {
      if (PLACEHOLDER.test(s)) r.error(where, `placeholder text in ${path}: "${s}"`);
    });

    if (d.status === 'verified') {
      const supported = new Set(citations.flatMap((c) => c.supports ?? []));
      for (const f of FACT_FIELDS) {
        if (isPopulated(get(d, f)) && !supported.has(f)) r.error(where, `verified record has "${f}" set but no citation supports it`);
      }
      (d.history ?? []).forEach((p, i) => { if (!p.cites?.length) r.error(where, `verified record: history[${i}] has no citation`); });
      (d.variants ?? []).forEach((v) => { if (!v.cites?.length) r.error(where, `verified record: variant "${v.name}" has no citation`); });
      if (d.gaps?.length) r.error(where, 'verified record still lists gaps; resolve them or keep it as draft');
      if (!citations.length) r.error(where, 'verified record has no citations');
    } else if (d.status === 'draft') {
      if (!d.gaps?.length) r.warn(where, 'draft with no gaps listed; say what is missing, or verify it');
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) r.error(where, 'file name must be lower-case-with-hyphens');
  }
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(checkSources().print() ? 0 : 1);
