// Builds incoming/to-confirm.md from data/pending-photos.yaml: one section per
// photographer with each post, its question and the evidence behind it, ready
// to paste into a message. Rerun whenever pending-photos.yaml changes.
//   node scripts/instagram/confirm-list.mjs [account]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

const ROOT = new URL('../../', import.meta.url).pathname;
const only = process.argv[2];
const { pending, awaiting_permission = [] } = YAML.parse(readFileSync(join(ROOT, 'data/pending-photos.yaml'), 'utf8'));
const KIND = { conflict: 'Their label and the source disagree', generation: 'Which generation?', model: 'Which model?' };
const byAccount = {};
for (const p of pending) if (!only || p.account === only) (byAccount[p.account] ??= []).push(p);

let md = '# Photos to confirm\n\nGenerated from `data/pending-photos.yaml` by `scripts/instagram/confirm-list.mjs`. Do not edit by hand.\n';
for (const [account, list] of Object.entries(byAccount)) {
  md += `\n## @${account} (${list.reduce((n, p) => n + p.photos.length, 0)} photos)\n`;
  for (const kind of ['conflict', 'generation', 'model']) {
    const items = list.filter((p) => p.kind === kind);
    if (!items.length) continue;
    md += `\n### ${KIND[kind]}\n\n`;
    for (const p of items) {
      const photos = p.photos.length > 1 ? ` (photos ${p.photos.join(', ')})` : '';
      md += `- **${p.post}**${photos}${p.model ? ` · ${p.model}` : ''}${p.guess ? ` · our guess: ${p.guess}` : ''}\n  ${p.question}\n`;
      // The generation-tells reference is the same on every Jet; list it once at the end instead.
      for (const e of p.evidence.filter((e) => !e.startsWith("Martijn's Jet article:"))) md += `  - ${e}\n`;
    }
  }
}
const asks = awaiting_permission.filter((p) => !only || p.account === only);
if (asks.length) md += '\n## Waiting on permission\n\nNo entry in `data/permissions.yaml` for these accounts yet, so nothing has been downloaded or placed.\n\n';
for (const p of asks) md += `- **@${p.account}** ${p.post} · ${p.model}${p.variant ? ` ${p.variant}` : ''}\n  ${p.question}\n${p.evidence.map((e) => `  - ${e}\n`).join('')}`;
md += "\n---\n\nGeneration tells used for Jets and Super-Jets, from Martijn van der Ven's Jet article (enicar.org): MkI paddle or dauphine hands, '33 jewels' dial, red crescent GMT hand (Jet) or red-tipped needle GMT hand (Super-Jet); MkII tuning-fork hands, slim orange or yellow-tipped GMT hand, sunburst dials; MkIII red and black checkered GMT hand, coloured bezels; MkIV cushion case.\n";
const out = join(ROOT, 'incoming', 'to-confirm.md');
writeFileSync(out, md);
console.log(`wrote ${out.replace(ROOT, '')}: ${pending.length} posts`);
