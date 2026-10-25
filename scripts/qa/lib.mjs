// Shared helpers for the QA scripts: load the data files and report results.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';

export const ROOT = new URL('../../', import.meta.url).pathname;
export const REF_DIR = join(ROOT, 'data/references');

export function loadYaml(path) {
  return YAML.parse(readFileSync(path, 'utf8'));
}

// All watch records as { id, file, data }.
export function loadReferences(dir = REF_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => ({ id: basename(f, '.yaml'), file: join('data/references', f), data: loadYaml(join(dir, f)) ?? {} }));
}

export function loadSources() {
  return loadYaml(join(ROOT, 'data/sources.yaml')) ?? [];
}

export function loadFamilies() {
  return loadYaml(join(ROOT, 'data/families.yaml')) ?? [];
}

// Read a data file as it was at a git revision; null if it didn't exist there.
export function gitShow(rev, path) {
  try {
    return execFileSync('git', ['show', `${rev}:${path}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

export function gitLsTree(rev, dir) {
  try {
    return execFileSync('git', ['ls-tree', '--name-only', `${rev}:${dir}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

// Value at a dotted path, e.g. get(obj, 'movement.calibre').
export function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function isPopulated(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

export class Report {
  constructor(name) { this.name = name; this.errors = []; this.warnings = []; }
  error(where, msg) { this.errors.push(`${where}: ${msg}`); }
  warn(where, msg) { this.warnings.push(`${where}: ${msg}`); }
  print() {
    for (const w of this.warnings) console.log(`  warn  ${w}`);
    for (const e of this.errors) console.log(`  FAIL  ${e}`);
    const status = this.errors.length ? 'FAIL' : 'ok';
    console.log(`${status}  ${this.name} (${this.errors.length} errors, ${this.warnings.length} warnings)`);
    return this.errors.length === 0;
  }
}

export { existsSync, join };
