# AskSocial Supabase reconciliation

This maintenance package is based on release candidate `199425a`. The files in this directory are run explicitly and live outside `supabase/migrations`. The two provisioning migrations remain byte-for-byte unchanged.

The reviewed production history records eight of the 26 predecessor migrations individually and retains `20260823232148 remote_schema`, a snapshot containing 426 statements. Thirteen unrecorded predecessors have their inspected effects present. Two more have the expected topic registry entries. The other three need schema changes. The package preserves the snapshot, all existing grants, and all prior history entries. It adds 18 history entries with null statement bodies because this repair does not replay the historical files.

## Authorized rollout sequence

1. Verify the target project, migration-owner connection, application base, and candidate commit against the approved rollout request. Record a fresh catalog and history inventory, confirm a recoverable backup, and prevent concurrent migration runners. Confirm the stored `remote_schema` statements SHA-256 is `13e549c956d2694db8d33d477a6c99788666a1d0649dcdcafbe5e59954e164bb` when joined with LF. Review the 18-version list and current topic grants before marking historical topic registration and backfills as baselined.
2. Apply [repair-schema.sql](repair-schema.sql) and [repair-history.sql](repair-history.sql) in the same transaction. Use a verified database connection configured through standard PostgreSQL environment or service settings. The schemas and table grants already in place determine the service role's effective access. The knowledge-store tables enable RLS and introduce no client policies.

   ```sh
   psql -X --set ON_ERROR_STOP=1 --single-transaction \
     --file supabase/reconciliation/repair-schema.sql \
     --command 'SET LOCAL search_path = pg_catalog, supabase_migrations, pg_temp' \
     --file supabase/reconciliation/repair-history.sql
   ```

   The transaction restores eight foundation indexes, creates both knowledge-store tables and their two indexes, and adds relationship provenance. Ledger verification checks the restored index definitions, RLS, provenance, the two registry entries, and the expected prior versions. It leaves the legacy topic-grant unique index for `202611180001` to replace. The SQL uses a five-second lock timeout and a two-minute statement timeout. Review table sizes and schedule a window for index builds before running it against production. Stop on unexpected state or timeout and inspect before retrying.

3. Apply [repair-pv-status.sql](repair-pv-status.sql) as a separate approved transaction. It accepts the known production constraint, the older disposable-preview constraint, or the already-corrected constraint. It preserves existing statuses and adds `manual_sent`. Verify PV transfer behavior before continuing.

   ```sh
   psql -X --set ON_ERROR_STOP=1 --single-transaction \
     --file supabase/reconciliation/repair-pv-status.sql
   ```

4. In a temporary CLI work directory with the candidate's exact `supabase/migrations` files and an otherwise empty Supabase configuration, add a comment-only `20260823232148_remote_schema.sql` marker **only after** verifying that the original snapshot is already recorded on the target. The temporary CLI marker matches the existing history version and is never executed or checked into Git. Run the pinned Supabase CLI 3.2.0 against the explicitly verified target with `db push --remote=<verified-target> --workdir <scratch> --skip-vault --dry-run`. Continue only if the sole pending versions are `202611180001` followed by `202611180002`. Review the target again before executing the approved push. Omit include-all, roles, and seed flags. Stop if the preview or resulting history differs. [Supabase CLI reference](https://supabase.com/docs/reference/cli/introduction)
5. Confirm both provisioning versions are recorded, the original snapshot is intact, and a second dry run has no pending migrations. Verify access permissions, tenant isolation, the audit path, and the separate PV controls. Complete the application rollout and invitation-delivery verification only under the approved deployment runbook.

## Stop and rollback

Before a failed SQL transaction commits, roll it back and recheck the catalog and ledger. After commit, pause the rollout and retain the reconciliation entries while assessing corrective action. Reverting a history entry would make old SQL eligible for replay. Avoid restoring the old PV check after any `manual_sent` rows exist. An application rollback can retain the additive database changes. Confirm a known-good database restore point before authorized production changes.

## Rehearsal evidence

The hosted Supabase SQL Editor ran the schema and PV repairs against `sponsor-closure-qa-20261103`. The preview has extra migrations, a different topic registry, and a provisioning table with the first migration's grants. To reproduce the production preconditions, the hosted test copied the stored snapshot and eight reviewed production history entries into a temporary ledger, and modeled the two production registry entries inside a rollback-only transaction. The existing preview ledger and grants were fingerprinted before and during the run. The test verified 27 resulting historical entries, all 426 original snapshot statements, safe history and PV repair retries, unchanged grants, and the six allowed PV transfer states. A separate rollback-only query applied the body of `202611180002` and ran the existing provisioning permission acceptance test on hosted Postgres. The post-rehearsal checks confirmed restoration of the baseline schema, the 17 preview ledger rows, the topic registry, PV constraint, and provisioning grants. This did not require access to production or change the disposable branch persistently.

A separate PostgreSQL 17 rehearsal ran these exact repair files against a production-shaped local ledger. It rejected premature history repair, accepted a verified retry, and preserved synthetic existing data. Supabase CLI 3.2.0 rejected the unmatched snapshot version before the scratch marker was present. With the marker, dry run listed only the two provisioning migrations in order. The CLI applied both unchanged files, stored their statements, and left all 29 resulting history rows including the original snapshot. A second dry run found no pending migrations. Provisioning and separate PV permission acceptance passed, and the local database shut down. This CLI sequence targeted localhost. The hosted rehearsal used the SQL Editor.
