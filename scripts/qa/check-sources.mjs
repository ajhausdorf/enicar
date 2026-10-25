// Editorial rules the schema can't express.
//
// Every record:
//   - citations have unique ids and point at a known source
//   - history, variant, reference-number and barometer cites point at a
//     citation on the record; read_more links name a known source
//   - images exist on disk and carry credit, licence and permission
//   - no placeholder text like "[confirm]" or "TODO" in any field
// Verified records, additionally:
//   - every populated fact field is listed in some citation's `supports`
//   - every reference number, history paragraph and variant cites something
//   - no open gaps
import { loadReferences, loadCalibres, calibreId, loadSources, loadPermissions, get, isPopulated, Report, existsSync, join, ROOT } from './lib.mjs';

// Fact fields that must be backed by a citation once a record is verified.
// List items (references, variants, history) carry their own `cites` instead.
export const FACT_FIELDS = [
  'nicknames', 'years.from', 'years.to', 'movement.calibres', 'movement.winding',
  'case.construction', 'case.material', 'case.diameter_mm', 'case.lug_mm', 'case.thickness_mm', 'features', 'dial'
];

const PLACEHOLDER = /\[(confirm|tbc|tbd|todo|source|date|price|ref|low|high|n|edition)[^\]]*\]|\bTODO\b|\bTBC\b|lorem ipsum/i;

function walkStrings(value, path, fn) {
  if (typeof value === 'string') fn(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}[${i}]`, fn));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walkStrings(v, path ? `${path}.${k}` : k, fn);
}

export const CALIBRE_FACT_FIELDS = ['maker', 'winding', 'functions', 'base', 'introduced'];

// Calibre records: citation integrity, and full coverage once verified.
function checkCalibres(r, sourceIds) {
  const calibres = loadCalibres();
  const ids = new Set(calibres.map((c) => c.id));
  for (const { id, file: where, data: d } of calibres) {
    const citeIds = new Set((d.citations ?? []).map((c) => c.id));
    for (const c of d.citations ?? []) {
      if (!sourceIds.has(c.source)) r.error(where, `citation "${c.id}" points at unknown source "${c.source}"`);
      for (const f of c.supports ?? []) if (!CALIBRE_FACT_FIELDS.includes(f)) r.error(where, `citation "${c.id}" supports unknown field "${f}" (allowed: ${CALIBRE_FACT_FIELDS.join(', ')})`);
    }
    (d.notes ?? []).forEach((n, i) => (n.cites ?? []).forEach((cid) => { if (!citeIds.has(cid)) r.error(where, `notes[${i}] cites "${cid}", which is not a citation on this record`); }));
    if (d.base && !ids.has(d.base)) r.error(where, `base "${d.base}" has no file in data/calibres/`);
    if (calibreId(d.name ?? '') !== id) r.error(where, `file name should be ${calibreId(d.name ?? '')}.yaml to match the name "${d.name}"`);
    walkStrings(d, '', (path, s) => { if (PLACEHOLDER.test(s)) r.error(where, `placeholder text in ${path}: "${s}"`); });
    if (d.status === 'verified') {
      const supported = new Set((d.citations ?? []).flatMap((c) => c.supports ?? []));
      for (const f of CALIBRE_FACT_FIELDS) if (isPopulated(d[f]) && !supported.has(f)) r.error(where, `verified calibre has "${f}" set but no citation supports it`);
      (d.notes ?? []).forEach((n, i) => { if (!n.cites?.length) r.error(where, `verified calibre: notes[${i}] has no citation`); });
      if (d.gaps?.length) r.error(where, 'verified calibre still lists gaps');
    }
  }
  return ids;
}

export function checkSources() {
  const r = new Report('sources and citations');
  const sourceIds = new Set(loadSources().map((s) => s.id));
  const calibreIds = checkCalibres(r, sourceIds);
  const permissionIds = new Set(loadPermissions().map((p) => p.id));

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
    (d.references ?? []).forEach((x) => checkCites(x.cites, `reference ${x.number}`));
    const named = [...(d.movement?.calibres ?? []), ...(d.variants ?? []).flatMap((v) => v.calibres ?? [])];
    for (const c of new Set(named)) {
      if (!calibreIds.has(calibreId(c))) r.error(where, `calibre "${c}" has no record; add data/calibres/${calibreId(c)}.yaml`);
    }
    const variantNames = new Set((d.variants ?? []).map((v) => v.name));
    for (const p of d.photos_elsewhere ?? []) {
      checkCites(p.cites, `photos_elsewhere "${p.label}"`);
      if (p.variant && !variantNames.has(p.variant)) r.error(where, `photos_elsewhere "${p.label}" names unknown variant "${p.variant}"`);
      if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(p.url)) r.error(where, `photos_elsewhere "${p.label}" links straight to an image file; link to the page instead`);
    }
    for (const m of d.read_more ?? []) {
      if (!sourceIds.has(m.source)) r.error(where, `read_more "${m.title}" points at unknown source "${m.source}"`);
      if (m.variant && !variantNames.has(m.variant)) r.error(where, `read_more "${m.title}" names unknown variant "${m.variant}"`);
    }
    if (d.barometer) checkCites([d.barometer.cite], 'barometer');

    for (const [i, img] of (d.images ?? []).entries()) {
      if (!img.credit || !img.license || !img.permission) r.error(where, `images[${i}] needs credit, license and permission`);
      if (img.variant && !(d.variants ?? []).some((v) => v.name === img.variant)) r.error(where, `images[${i}] is tagged "${img.variant}", which is not a generation on this record`);
      if (img.identified_by && img.identified_by !== 'dial' && !img.identified_note) r.error(where, `images[${i}] identified by ${img.identified_by} needs an identified_note saying how`);
      if (img.permission === 'granted' && !permissionIds.has(img.permission_ref)) r.error(where, `images[${i}] says permission granted but permission_ref "${img.permission_ref ?? ''}" is not in data/permissions.yaml`);
      for (const key of ['file', 'thumb']) {
        const f = img[key];
        if (!f) continue;
        if (/^https?:/.test(f)) r.error(where, `images[${i}].${key} must be a local file under public/images, not a hotlink`);
        else if (!f.startsWith(`/images/${id}/`)) r.error(where, `images[${i}].${key} must live in /images/${id}/`);
        else if (!existsSync(join(ROOT, 'public', f))) r.error(where, `images[${i}].${key} ${f} not found under public/ (use scripts/images/add-image.mjs)`);
      }
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
      (d.references ?? []).forEach((x) => { if (!x.cites?.length) r.error(where, `verified record: reference ${x.number} has no citation`); });
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
