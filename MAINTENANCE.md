# Maintenance log – dach-company-data-extractor

Weekly automated maintenance (Claude cloud routine, approved as B-5 on 2026-10-27). Each run appends one entry. Rules for the routine:
- Never spend money, never change pricing, never create new Actors, never message external parties.
- Fixes are committed to `main`; Apify rebuilds automatically via the GitHub webhook.
- Message the owner only for real blockers (Actor marked faulty, user issue needing a human, build failures that cannot be fixed).

| Date (UTC) | Public stats (users / users30d / runs) | Tests | Smoke (5 domains) | Issues handled | Changes pushed | Notes |
|---|---|---|---|---|---|---|
| 2026-10-27 | 2 / 1 / 3 (owner test runs) | 15/15 | 18/20 benchmark (local) | – | initial publish | baseline |
| 2026-11-02 | DACH: 2 / 1 / 9 runs (30d: 6 ok, 0 failed), 2 pricing infos; EU: 2 / 1 / 10 runs (30d: 5 ok, 0 failed), 1 pricing info; both public | 16/16 (after fixing `npm test` script for Node 22: `node --test test/*.test.js`) | 0/5 – all requests timed out in the routine sandbox (outbound proxy; example.com reachable, target sites time out), environmental, no code defect shown | – (no APIFY_TOKEN: runs/issues not checked) | package.json test script | Re-run smoke locally/with open network. No revenue figure known; only Console > Payouts counts. |
