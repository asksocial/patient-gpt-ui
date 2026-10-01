# ICSR email release checklist — October 1, 2026

Release decision: **HOLD**. The implementation and staging database checks pass; production dependency remediation is complete. Deployed application acceptance remains open.

## Verified target and release identity

- Latest successful GitHub-recorded Vercel **Preview**: [September 23 preview](https://patient-gpt-fcvqwgddp-asksocial-2711s-projects.vercel.app).
- Deployment: `6622223298`, created September 23, 2026 at 3:08 PM America/New_York; successful status at 3:08:45 PM.
- Deployed SHA: `302bb12a50a9571685ba0bad61464d2c19301b15`.
- Local branch: `codex/icsr-email-release`, based on that SHA; the new ICSR implementation and acceptance helpers are being prepared for Preview.
- Supabase staging: **Patient GPT / staging**, project `ayoekepctukiqzuhrmvf`, verified in the authenticated dashboard.
- Local `.env.local` points to **production** (`hvnwbigjohspncdrhsjy`), not staging. It was not changed. Local database preflight results must not be mistaken for staging results.
- Vercel has a separate Preview-only `SUPABASE_URL`, stored as a write-only Secret. Its value cannot be revealed from the dashboard. A release owner must confirm its staging target before database-writing acceptance. Production deploys from `main`; this release uses a separate Preview branch.

## Completed evidence

| Check | Result | Evidence/qualification |
| --- | --- | --- |
| Repository-wide ESLint | Passed | `npm run lint`, exit 0 |
| Full regression suite including ICSR A–I | Passed | `npm run test:production`, exit 0, including its pretest |
| TypeScript and new acceptance-script lint | Passed | `tsc --noEmit` and targeted ESLint, exit 0 |
| Production build | Passed | `npm run build`, exit 0 after acceptance-script additions |
| Existing environment/corpora/platform preflight | Passed | `npm run preflight`; local production target, stateless Knowledge Store |
| Staging ICSR migration | Applied and verified | `202610010001_create_pv_icsr_email_reviews.sql`, executed as one transaction in staging SQL Editor |
| Live staging database acceptance | Passed | `supabase/tests/pv_icsr_acceptance.sql`; all assertions succeeded, final ROLLBACK |
| Access boundaries | Passed at SQL layer | RLS enabled on both tables; anon/authenticated direct table access and RPC execution denied; service-role RPC allowed |
| Tenant write separation | Passed at SQL layer | Foreign principal rejected by the RPC |
| Optimistic locking | Passed for stale writes | Expected revision mismatch rejected; true simultaneous HTTP writes still pending |
| Immutable extraction/history | Passed | Original extraction changes and revision UPDATE/DELETE rejected |
| Atomic persistence | Passed | Case state and revision count verified after successful and rejected writes |
| Fixture cleanup | Passed | Verification query returned `synthetic_records_remaining = 0` |

The staging dashboard showed an “Unhealthy” status and a provider incident banner during inspection. SQL requests nevertheless completed successfully. Confirm service health before acceptance/promoting; do not infer an outage was resolved from successful SQL alone.

## Open action items, in execution order

| Priority | Action | Suggested responsible role | Completion criterion |
| --- | --- | --- | --- |
| P0 | Remediate production dependency audit findings | Engineering | `npm run audit:production` exits 0; rerun lint, regression tests and build after dependency changes |
| P0 | Verify preview → staging database mapping | Release engineer | Preview `SUPABASE_URL` points to `ayoekepctukiqzuhrmvf`; test authentication/entitlements use intended staging accounts |
| P0 | Commit the reviewed implementation and deploy it to Preview | Engineering / release engineer | Record a new exact release SHA and successful Preview deployment; ICSR GET/PATCH route is present |
| P0 | Complete authenticated tenant/entitlement checks | QA / security reviewer | Own synthetic case readable; known foreign case/history denied; signed-in non-PV user receives 403; signed-out request reaches AskSocial and is denied |
| P0 | Exercise simultaneous HTTP edits | QA | Two reviewers save from one revision: exactly one success and one 409; reload shows the winner; no lost correction |
| P0 | Perform desktop/mobile and keyboard acceptance | QA + PV reviewer | Source → field evidence → correction → confirmation → approval → preview → copy/export → manual sent works; incomplete cases retained and blocked from complete-ICSR approval |
| P0 | PV review of wording and missing-information handling | Qualified PV reviewer | Approves the template, attributed narrative, seriousness evidence labels, username handling and disclaimer under client procedures |
| P1 | Verify migration bookkeeping in the deployment process | Release engineer | Record that this migration was manually applied to staging; reconcile any migration ledger before an automated runner attempts to reapply it |
| P1 | Verify staging service health | Release engineer | Provider/project health acceptable and requests stable during acceptance |
| P0 before production | Establish release/rollback evidence | Release engineer | Record current production deployment SHA, selected release SHA, test results and approver; app rollback retains new tables/revisions |
| P0 before production | Apply the additive migration to production and promote approved SHA | Release owner | Explicit production release decision; production schema preflight passes; smoke tests pass; evidence/history retained |

Production was not changed. The feature was not deployed. The staging migration creates tables, indexes, a trigger and the server-only write RPC; it does not modify existing PV data or clocks. Prefer rolling back the application deployment while retaining additive tables/history; do not drop safety-case revisions as a routine rollback.

## Dependency remediation — completed October 1

The initial production audit reported **5 vulnerabilities: 1 critical, 3 high, 1 moderate**. After remediation, a fresh `npm audit --omit=dev` returned **zero production vulnerabilities**.

Updated Next and eslint-config-next to 16.3.8 and the explicit PostCSS override to 8.5.28. The lockfile resolves sharp 0.35.5, nanoid 3.3.19 and baseline-browser-mapping 2.11.26. Repository-wide lint and the production build passed after these changes.

Development-only findings are separate from this production-only result. Authenticated application acceptance and qualified PV signoff remain release gates.

## Repeatable acceptance helpers

- `npm run preflight:pv-icsr`: read-only required-table/column queries, with optional anonymous denial checks. Set `ASKSOCIAL_PV_EXPECTED_SUPABASE_REF` to the intended project reference to reject accidental production/staging mismatch. No case text or credentials are printed.
- `npm run smoke:pv-icsr`: read-only application checks. Loads local configuration, verifies response shape/cache control, and tests known own/foreign synthetic cases and denied-entitlement users when configured.
- `supabase/tests/pv_icsr_acceptance.sql`: database assertion test with synthetic data and final ROLLBACK. Already passed in the identified staging branch.
- `npm run release:check`: now includes `preflight:pv-icsr`, so the release gate cannot silently omit the new schema.

Keep cookies and credentials in local environment variables or the approved secret store, never in this checklist or Git. Optional staging settings are documented in `.env.example`:

```text
ASKSOCIAL_STAGING_URL
ASKSOCIAL_STAGING_SESSION_COOKIE
ASKSOCIAL_PV_STAGING_RECORD_ID
ASKSOCIAL_PV_OTHER_TENANT_RECORD_ID
ASKSOCIAL_PV_DENIED_SESSION_COOKIE
ASKSOCIAL_PV_EXPECTED_SUPABASE_REF
ASKSOCIAL_STAGING_VERCEL_BYPASS
```

The current CLI smoke attempt stopped at **Vercel deployment protection** (`/sso-api`) before AskSocial authentication. This is an access prerequisite, not a passed application security check. Use the existing authenticated browser or an already-authorized local deployment-protection bypass credential. No protection settings were weakened and no new bypass credentials were created.

## Manual UX pass

- [ ] Review every extracted value and its supporting source; distinguish original extraction from human correction.
- [ ] Missing patient and missing reporter cases remain visible with the minimum-criteria review message.
- [ ] Multiple products and events remain distinct through saved review and email output.
- [ ] Hospitalization language stays evidence; classification remains a human PV assessment.
- [ ] Reporter causality remains attributed source text.
- [ ] Missing clinical fields remain “Not reported”; explicit unknown stays distinct.
- [ ] Correct an event, save, reload, and confirm original/reviewed values and reviewer/time in the audit.
- [ ] Approve, generate preview, edit recipients/subject/body, retain the disclaimer, save, copy and export.
- [ ] Confirm internal notes/assessment do not appear in the external export.
- [ ] Record sent only with recipients and explicit reviewer attestation; no automatic transmission occurs.
- [ ] Any later case correction invalidates approval and the current email preview.
- [ ] Test keyboard focus, labels, expanded sections, errors, long excerpts and mobile layout.

Release approval: pending. Approved SHA: pending. Authenticated application acceptance: pending.
