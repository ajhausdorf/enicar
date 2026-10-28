// Barometer price history: past editions from data/barometer-history.yaml,
// plus the current edition from the record itself.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

export interface Band { condition: string; low: number | null; high: number | null; note?: string }
export interface Point { n: number; date: string; url: string; label: string; bands: Band[] }

const file = YAML.parse(readFileSync(join(process.cwd(), 'data/barometer-history.yaml'), 'utf8'));
const editions: { n: number; date: string; url: string }[] = file.editions.map((e: any) => ({ ...e, date: String(e.date instanceof Date ? e.date.toISOString().slice(0, 10) : e.date) }));
const byNumber = Object.fromEntries(editions.map((e) => [e.n, e]));

// Every edition's figures for one entry of the current edition, oldest first.
export function historyOf(entry: { label: string | null; bands: Band[] }, edition: string): Point[] {
  const series = file.series.find((s: any) => entry.label && s.current.includes(entry.label));
  const past: Point[] = (series?.past ?? []).map((p: any) => ({ ...byNumber[p.edition], label: p.label, bands: p.bands }));
  const n = Number(edition.match(/#(\d+)/)?.[1]);
  const now = byNumber[n];
  return now ? [...past, { ...now, label: entry.label ?? '', bands: entry.bands }] : past;
}
