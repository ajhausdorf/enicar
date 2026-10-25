---
name: add-reference
description: Research and add a new Enicar watch record (or fill gaps in a draft) with full citations. Use when asked to add a model or reference, or to work through the coverage gaps.
---

# Add or extend a reference

1. **Check it isn't already here.** Search `data/references/` for the name,
   nicknames and reference number. If it exists, extend that record instead.
2. **Research.** Start from the sources in `data/sources.yaml`, then follow
   their links. For each fact, keep the exact URL you read it on.
3. **Add any new source** to `data/sources.yaml` with `status: to-confirm`
   and `author: null` unless you have confirmed who runs it.
4. **Write the record** at `data/references/<id>.yaml`: lower-case hyphenated
   id from the model name (`sherpa-super-dive`), or the name plus reference
   number when several references share a name. Copy the shape of
   `sherpa-graph.yaml`. Facts you can't source stay `null` and go in `gaps`.
5. **Cite.** One citation per page read; list exactly the fields that page
   supports. History paragraphs: your own words, `cites` listing ids.
6. **Status.** `draft` unless every rule for `verified` in CLAUDE.md holds.
7. Run `npm run check`. Fix every FAIL.
8. Hand off to `ship-update`.

Never invent a reference number, year or measurement. A record with honest
gaps is better than a complete-looking wrong one.
