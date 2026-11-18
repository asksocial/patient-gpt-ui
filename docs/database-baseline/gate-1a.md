# Gate 1A migration baseline and hosted history

This baseline records the 40 AskSocial migration files through `202611180001_admin_user_provisioning.sql` for empty, isolated development databases. It preserves deployment history separately from the PostgreSQL and PostgREST permission acceptance results.

## Migration inventory and order

The [migration manifest](migrations.sha256) lists each exact filename and its SHA-256 in replay order. The manifest SHA-256 is `e3be7f57c93a8b5daa5306407d84213a6f980c4bb45e1238e3b36e9a262d3112`. The 18 files already tracked at the start of the review match the working tree. The remaining 22 existing files were reviewed in these groups:

| Previously untracked versions | Contents and dependencies |
| --- | --- |
| `202610170001`, `202610170002`, `202610190001`, `202610200001`, `202610200002`, `202610290001` | ODCS and background operations depend on earlier PV case and delivery tables. Reportability and email revisions replace earlier guarded routines. GLP-1 registration uses the legacy topic grant key. |
| `202611020001`, `202611020002`, `202611030001`, `202611120001` | Incomplete screening, review auditing and sponsor closure extend earlier PV relations and routines. Monitoring scope extends continuous intelligence. |
| `202611130001`, `202611130002`, `202611160001`–`202611160005`, `202611170001`–`202611170004` | Evidence Integrity starts with workspace and membership prerequisites, then adds assessment, screening, qualification, monitoring, reporting, validation, release controls, and alerts. |
| `202611180001` | Provisioning adds the Clerk organization contract, replaces topic grant uniqueness, and uses the platform audit table and the Supabase `auth.jwt()` helper. |

Review covered version uniqueness, ordered dependencies, DDL and data changes, hardcoded credential patterns, inline sensitive data, and external SQL calls. The seed changes concern existing application configuration, such as topic registration and a scheduler heartbeat. Some files replace constraints or routines. The PV background migration changes existing queued or retry rows, and the GLP-1 migration can add grants for existing users. The provisioning migration has unconditional DDL. Its installed form must not be replayed over existing provisioning objects.

For reproduction, use the exact files and order from the manifest. Hash the raw file bytes before applying them. Compare schema-only PostgreSQL dumps after removing the per-dump `\restrict` and `\unrestrict` nonce lines. Keep real content and environment credentials out of the test setup.

## Historical Supabase snapshot

Production and the existing QA preview both record `20260823232148 remote_schema` with 426 stored statements. The SHA-256 of the UTF-8 statements joined with LF is `13e549c956d2694db8d33d477a6c99788666a1d0649dcdcafbe5e59954e164bb`. The first statement is `SET statement_timeout = 0`. The dump-style definitions and filename are consistent with a Supabase schema pull. The ledger record establishes that the objects inspected below were captured, with their original creation dates unresolved. [Supabase local migration workflow](https://supabase.com/docs/guides/local-development/database-migrations)

| Captured object family | Source-defined development counterpart |
| --- | --- |
| `chat_sessions`, `user_therapeutic_access`, `curated_insights` | `202607160001_create_application_foundation.sql`. Provisioning later changes chat and topic scope. |
| `intelligence_workspaces` and `intelligence_workspace_members` | `202607310001_create_platform_persistence.sql` and `202608080001_create_workspace_management.sql`. |
| `pv_records` | `202608060001_create_pv_compliance_services.sql` and subsequent PV revisions. |
| `extensions.vector`, `public.documents`, and `public.match_documents` | The legacy document-vector feature is outside this baseline. Hosted catalogs have `documents.embedding vector(1536)` and an IVFFlat cosine index. The current checked-in Ask path does not require this contract for Corpus Builder foundation work. |

A whole-snapshot replay would overlap application, workspace and PV migrations and can duplicate objects or restore obsolete definitions. Treat the stored statements as historical evidence. Keep both hosted ledgers as they are. A future dependency on the legacy vector objects requires a reviewed exact definition and a separate rollout decision. The table records verified families and is not a full object-by-object equivalence assertion.

## Supabase-compatible replay

Two independent fresh PostgreSQL 17.12 clusters applied all 40 migration files. Each ran PostgREST 14.18 on loopback using an independent synthetic JWT signing key and database credentials. The database used the Supabase API roles, API-role switching, and broad `public` default grants on tables, sequences, and functions. The local `auth.jwt()` function read PostgREST's request claims, including `sub` and `o.id`. This exercises database and API behavior with signed tokens. Clerk invitations, CDN configuration, and deployed HTTP behavior require separate integration tests. [Supabase database bootstrap](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000000-initial-schema.sql) · [PostgREST release](https://github.com/PostgREST/postgrest/releases/tag/v14.18)

Both builds produced normalized schema SHA-256 `1915edb55e87812f13619e41fa4184bb4b5f3ae30ebb52c0d0fa55c581ac500e`. Migration hashes, effective privilege checks, and authorization results matched across builds. The [results record](permission-profile-results.json) contains the catalog results and observed HTTP status codes.

To reproduce the profile, start two empty PostgreSQL 17 instances independently. Define `anon` and `authenticated` as login-disabled API roles and `service_role` as login-disabled with `BYPASSRLS`. Give a local `authenticator` role login and role-switch membership in the three API roles without inherited privileges. Give the three API roles schema usage and all default table, sequence, and function privileges on `public` for the migration owner. Install `pgcrypto` in `extensions` and give the API roles schema usage. Define `auth.jwt()` as a stable SQL function returning `nullif(current_setting('request.jwt.claims', true), '')::jsonb` and give the API roles usage on `auth`. Apply the manifest sequence. Bind PostgREST to loopback, expose `public`, set the anonymous role to `anon`, and use a fresh secret for local signed JWTs. Use synthetic accounts and workspaces for tests and discard the credentials after the run.

## Effective permissions and QA comparison

Table grants and row access are separate. RLS limits the tested topic rows, and `service_role` bypasses RLS. RLS also does not govern `TRUNCATE`. The evidence covers the listed objects and API roles.

| Object | `anon` | `authenticated` | `service_role` | QA catalog comparison |
| --- | --- | --- | --- | --- |
| `user_provisioning` | No direct grants | No direct grants | SELECT, INSERT, UPDATE, DELETE, TRUNCATE | Same tested rights |
| `user_therapeutic_access` | Broad table grants, no topic rows in test | Broad table grants, own active organization rows and all five columns readable in test | Broad table grants, bypasses RLS | Same grants, five readable columns, and scoped SELECT policy |
| Topic ID sequence | USAGE, SELECT, UPDATE | USAGE, SELECT, UPDATE | USAGE, SELECT, UPDATE | Same |
| `change_user_provisioning` and `append_intelligence_audit_event` | No execute | No execute | Execute | Same |
| `has_active_managed_topic_scope` | No execute | Execute | Execute | Same |
| Chat, workspace, membership, platform audit tables | Broad table grants | Broad table grants | Broad table grants | Same checked grants |
| Evidence corpus and ingestion tables and ingestion sequence | No direct grants | No direct grants | No direct grants | Same checked grants |
| Evidence create, read and claim RPCs | No execute | No execute | Execute, with scoped RPC checks where applicable | Same checked execute grants |
| `pv_audit_events` | Broad table grants | Broad table grants | SELECT, INSERT, TRUNCATE. UPDATE and DELETE grants absent. | QA also has service-role UPDATE and DELETE. The native replay installs `pv_audit_no_mutation`. The QA catalog query found no enabled user trigger on this table. |

In the matrix, broad table grants include SELECT, INSERT, UPDATE, DELETE, and TRUNCATE. The local transport role `authenticator` has no direct grants on the tested objects until role switching. QA has the same inspected membership options for the three API roles. QA's three API roles have the `INHERIT` attribute, whereas the local bootstrap used `NOINHERIT`. The inspected named-role memberships and effective privileges show no additional access arising from that attribute in this scope. Existing application workers use the server service credential. The examined migrations define no separate AskSocial worker role.

## Disposition of permission discrepancies

| Finding | Origin and application dependency | Proposed correction and risk | Disposition |
| --- | --- | --- | --- |
| Provisioning table permits direct service writes | Inherited table defaults. The application reads the table directly and submits transitions through `change_user_provisioning`. In both API tests service-role INSERT returned 201, UPDATE and DELETE returned 200, and the provisioning audit count stayed at two. | Preserve service SELECT and transition RPC execution. Explicitly revoke direct provisioning mutation and TRUNCATE privileges. Verify invitation, suspend/restore, revision, and audit behavior. Inventory administrative scripts before rollout. | **Unresolved blocker** |
| Managed topic SELECT includes `id` and `created_at` | Inherited table-wide SELECT. The scoped application reads `therapeutic_area` and filters by `clerk_user_id` and `organization_id`. | Remove the inherited client table privileges and retain the required column SELECT and scoped RLS policy. Restrict direct client sequence access if dependent consumers are absent. Check legacy scoped queries and PostgREST behavior. | **Unresolved least-privilege discrepancy** |
| Chat, workspace, membership, and platform audit table grants are broad in both profiles | Inherited defaults. Server workspace and chat paths use table access. The platform audit append is security-invoker and requires service SELECT and INSERT. | Inventory application callers before narrowing object by object. Keep the server operations that are required and remove unsupported client access and unnecessary destructive privileges. Audit append or workspace operations could regress if their required rights are withdrawn. | **Unresolved, requires scope and ACL approval** |
| Legacy PV direct audit INSERT and QA's additional UPDATE and DELETE grants | `202610290001` restores service INSERT for an older Structured Review release. The current inspected service appends through `append_pv_audit_event`. QA grants broader rights than the replay and lacks its inspected mutation trigger. | Have PV owners verify historical callers and agree on the final grant and trigger contract. Keep required audit read and append operations. Retire legacy direct writes and remove unused destructive grants only after compatibility testing. | **Unresolved PV compatibility and audit issue** |
| QA and local API-role `INHERIT` attributes differ | Profile setup difference. Tested role switching and scoped privileges are equivalent for this membership graph. | Match the target role flags for a future hosted-equivalence check and review any extra memberships first. Changing role inheritance in place can alter unrelated consumers. | **Documented difference, no exception approved** |

Application references include [provisioning store](../../src/lib/auth/provisioning/store.ts), [scoped topic access](../../src/lib/auth/provisioning/session.ts), [platform persistence](../../src/lib/intelligence-platform/persistence.ts), and [PV audit compatibility](../../supabase/migrations/202610290001_pv_legacy_audit_compatibility.sql).

## Regression results and release boundary

Both native replays passed ICSR, reportability identification, and PV Operations acceptance as owner and `service_role`. PV Operations used the repository's synthetic incident-aging fixture in each test session. The full-chain ODCS test failed in both builds and roles at the direct audit INSERT assertion, which predates the compatibility migration. The repository's earlier ODCS checkpoint suite passed. Provisioning tests passed both legacy indexes. Evidence Integrity foundation tests passed scoped access, immutable manifests, provenance and atomic rollback. Evidence Integrity HTTP checks passed for owner access, non-admin denial, viewer write denial, foreign workspace denial, and direct service table denial. Supplemental PV compliance, incomplete screening, and sponsor closure tests passed. Production and existing QA were queried for metadata only.

**Gate 1A is blocked.** Portability and replay checks passed. Approval is still required for an additive least-privilege correction and PV audit compatibility disposition. Rerun effective privilege, HTTP and PV checks on a fresh disposable profile after approval. This preserved history is suitable for reproducing the findings and does not clear the gate for Corpus Builder implementation.
