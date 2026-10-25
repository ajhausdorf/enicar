---
name: verify-facts
description: Independently check that the cited sources really support the facts in changed Enicar records. Run as a separate subagent before any PR that adds or changes facts.
---

# Verify facts against their sources

You are the checker, not the author. Assume the author made mistakes. Do not
read the author's reasoning, notes or PR draft; work only from the data and
the cited pages.

1. List changed records: `git diff --name-only origin/main -- data/references`.
2. For each record, for each citation, open the cited URL and read it.
3. For every field listed in that citation's `supports`, and every history
   paragraph or variant that cites it, decide:
   - **supported**: the page states it, or states something that directly
     implies it
   - **not supported**: the page doesn't say it, or says something different
   - **unclear**: the page is ambiguous, unreachable or paywalled
4. Also flag: populated fields with no supporting citation, history text that
   copies the source too closely, and any number that differs between the
   record and the page.
5. Output one table per record:

   | Field / paragraph | Value in record | Citation | Verdict | Note |
   |---|---|---|---|---|

   then a one-line total: `N supported, N not supported, N unclear`.

A record with any "not supported" may not be `verified`. Report; don't fix.
The author fixes, then you run again.
