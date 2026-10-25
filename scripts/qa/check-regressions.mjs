// Compares the data against a base revision (default origin/main) and
// blocks the kinds of change that usually mean an update went wrong:
//   - records deleted
//   - a verified record downgraded to draft, or losing citations
//   - a barometer range moving more than BAROMETER_MAX_MOVE
//   - more than MAX_CHANGED records touched in one change
// It also writes a plain-English summary to qa-summary.md for the PR.
//
// Deliberate exceptions go in qa-allow.yaml (see CLAUDE.md), which is reviewed
// with the change and deleted after merge.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { loadReferences, gitShow, gitLsTree, Report, ROOT, loadYaml } from './lib.mjs';

const MAX_CHANGED = 25;
const BAROMETER_MAX_MOVE = 0.3;

const base = process.env.QA_BASE ?? 'origin/main';

function loadAllow() {
  const p = join(ROOT, 'qa-allow.yaml');
  const a = existsSync(p) ? loadYaml(p) ?? {} : {};
  return { removed: new Set(a.removed ?? []), downgraded: new Set(a.downgraded ?? []), barometer: new Set(a.barometer ?? []), large: a.large_change === true, reason: a.reason ?? null };
}

// Every price band on a record (its own guide and each generation's), keyed so
// the same band can be compared across versions.
function bands(d) {
  const out = new Map();
  const add = (bar, where) => bar?.entries?.forEach((e) => e.bands.forEach((b) => out.set(`${where} ${e.label ?? ''} ${b.condition}`.trim(), b)));
  add(d.barometer, '*');
  for (const v of d.variants ?? []) add(v.barometer, v.name);
  return out;
}

export function checkRegressions() {
  const r = new Report(`regressions vs ${base}`);
  const baseFiles = gitLsTree(base, 'data/references');
  const summary = [];
  if (baseFiles == null) {
    r.warn('base', `no ${base} to compare against (first push?); regression checks skipped`);
    writeFileSync(join(ROOT, 'qa-summary.md'), `No base revision (${base}) to compare against.\n`);
    return r;
  }
  const allow = loadAllow();
  const now = new Map(loadReferences().map((x) => [x.id, x]));
  const before = new Map(baseFiles.filter((f) => f.endsWith('.yaml')).map((f) => {
    const id = f.replace(/\.yaml$/, '');
    return [id, YAML.parse(gitShow(base, `data/references/${f}`) ?? '') ?? {}];
  }));

  const added = [...now.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !now.has(id));
  const changed = [...now.keys()].filter((id) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(now.get(id).data));

  for (const id of removed) {
    if (!allow.removed.has(id)) r.error(`data/references/${id}.yaml`, 'record deleted; list it under `removed` in qa-allow.yaml with a reason if intended');
  }

  const touched = added.length + removed.length + changed.length;
  if (touched > MAX_CHANGED && !allow.large) {
    r.error('change size', `${touched} records touched (limit ${MAX_CHANGED}); split the change or set large_change: true in qa-allow.yaml with a reason`);
  }

  for (const id of changed) {
    const a = before.get(id); const b = now.get(id).data; const where = `data/references/${id}.yaml`;
    const lines = [];
    if (a.status === 'verified' && b.status !== 'verified' && !allow.downgraded.has(id)) r.error(where, 'verified record downgraded to draft; list under `downgraded` in qa-allow.yaml if intended');
    if (a.status !== b.status) lines.push(`status ${a.status} → ${b.status}`);
    const ca = (a.citations ?? []).length; const cb = (b.citations ?? []).length;
    if (a.status === 'verified' && cb < ca && !allow.downgraded.has(id)) r.error(where, `verified record lost citations (${ca} → ${cb})`);
    if (ca !== cb) lines.push(`citations ${ca} → ${cb}`);
    const ba = bands(a), bb = bands(b);
    for (const [key, x] of ba) {
      const y = bb.get(key);
      if (!y) continue;
      for (const k of ['low', 'high']) {
        if (x[k] == null || y[k] == null) continue;
        const move = Math.abs(y[k] - x[k]) / Math.max(x[k], 1);
        if (move > BAROMETER_MAX_MOVE && !allow.barometer.has(id)) r.error(where, `barometer ${key} ${k} moved ${(move * 100).toFixed(0)}% (${x[k]} → ${y[k]}); list under \`barometer\` in qa-allow.yaml if the source changed`);
      }
    }
    for (const k of Object.keys({ ...a, ...b })) {
      if (['citations', 'status', 'last_reviewed'].includes(k)) continue;
      const empty = (v) => v == null || (Array.isArray(v) && v.length === 0);
      if (empty(a[k]) && empty(b[k])) continue;
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) lines.push(`${k} changed`);
    }
    summary.push(`- **${b.name ?? id}** (\`${id}\`): ${lines.join('; ') || 'review date only'}`);
  }

  const doc = [
    `### Data change summary vs \`${base}\``,
    '',
    `${added.length} added · ${changed.length} changed · ${removed.length} removed`,
    '',
    ...(added.length ? ['**Added**', ...added.map((id) => `- ${now.get(id).data.name} (\`${id}\`, ${now.get(id).data.status})`), ''] : []),
    ...(summary.length ? ['**Changed**', ...summary, ''] : []),
    ...(removed.length ? ['**Removed**', ...removed.map((id) => `- \`${id}\``), ''] : []),
    ...(allow.reason ? [`**Exceptions claimed (qa-allow.yaml):** ${allow.reason}`, ''] : [])
  ].join('\n');
  writeFileSync(join(ROOT, 'qa-summary.md'), doc);
  return r;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(checkRegressions().print() ? 0 : 1);
