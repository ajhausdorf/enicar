---
name: ship-update
description: Take a finished change to Enicar World through checks, independent verification and a pull request for the owner to merge. Use at the end of every change.
---

# Ship an update

1. Work on a branch: `git switch -c <type>/<short-name>` (e.g.
   `data/sherpa-jet`, `fix/broken-link`). Never commit to `main`.
2. `git fetch origin && npm run check`. Every line must be `ok`. Fix FAILs at
   their cause; don't edit the checks to pass unless the owner asked.
3. If facts changed, run the `verify-facts` skill in a separate subagent and
   resolve anything not supported.
4. Look at the result: `npm run build && npx astro preview`, open each
   changed page, and confirm it shows what the data says.
5. Commit with a message saying what changed and why. Push the branch.
6. `gh pr create` using `.github/pull_request_template.md`. Include the
   verification table and any `qa-allow.yaml` reason.
7. Wait for CI. If it fails, fix and push again.
8. Report to the owner in plain language: what changed, how many records,
   anything uncertain, and the PR link. Then stop. The owner merges.
