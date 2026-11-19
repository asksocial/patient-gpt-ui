# AskSocial User Management

Platform administrators can open **Administration → User Management** at `/admin/users`. Provision an email, select an existing Clerk organization and an AskSocial role, and assign active topics. Clerk delivers a seven-day invitation and hosts credential setup. An invitation for a client uses Clerk's `org:member` role. The recipient's application role is enforced by AskSocial and cannot be edited through Clerk's frontend.

| Role | Access |
| --- | --- |
| Platform Admin | Platform administration and topic access. Provisioned Platform Admins require an explicit PV Compliance entitlement. |
| Client Admin | Scoped organization and topic access, including workspace management and member administration for that scope. |
| Client Analyst | Scoped organization and topic access, including workspace work and shared content according to workspace membership. |
| Read-Only Viewer | Scoped workspace and corpus reads. Questions can run without saving conversation history or work products. |

PV Compliance capability grants remain in **Entitlements**. ODCS reviewer qualification uses the existing PV approval workflow. Neither is set by User Management. Existing Platform Admins retain their current entitlement behavior.

## Setup in a disposable environment

1. Use a Clerk development instance and a separate Supabase project or local stack. Use test mailboxes and at least two Clerk organizations.
2. In Clerk, enable email and verified primary email, the desired password or other approved credential flow, Organizations, and Account Portal. Set access mode to **Invite-only**. Restrict organization invitation privileges and disable automatic domain enrollment for managed client organizations. Use a basic `org:member` role without Clerk-side administrative permissions. Check that the Account Portal returns users to the application after signup or sign-in. [Clerk access modes](https://clerk.com/docs/guides/secure/restricting-access) · [Organization invitations](https://clerk.com/docs/guides/organizations/add-members/invitations)
3. Activate Clerk's native Supabase integration and add the exact Clerk issuer to the Supabase project's third-party auth providers. Use current Clerk session claims with `sub`, the active organization in `o.id`, and `role: authenticated`. Keep Supabase Auth public registration disabled if it is unused in the project. [Clerk and Supabase integration](https://clerk.com/docs/guides/development/integrations/databases/supabase)
4. Apply the repo's Supabase migrations through `202611180002_restrict_provisioning_privileges.sql` in the disposable database before starting this build. Enable a test bootstrap administrator with Clerk public user metadata `role: admin`.
5. Set these variables on the app server.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk environment's publishable key |
| `CLERK_SECRET_KEY` | Clerk environment's backend key |
| `SUPABASE_URL` | The corresponding Supabase API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server-only key for trusted management and existing data routes |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key or legacy anon key for requests using the caller's Clerk token and RLS |
| `ASKSOCIAL_APP_ORIGIN` | Exact application origin, such as `http://localhost:3000`, without a trailing slash |

The server reads scoped corpus grants with the recipient's Clerk token. Scoped requests require a publishable or legacy anon key and a session token with Clerk's Supabase integration role claim. RLS requires the verified subject, active organization, active managed account, and active topic. The protected server routes apply these grants before corpus retrieval and constrain existing tenant data queries to their verified principal. The migration leaves legacy topic grants in their existing user-wide scope and keeps direct client access to other protected data tables closed.

## Invitations and account recovery

- A verified existing Clerk member of the selected organization can be enrolled directly when they hold the basic membership role and have no other organization memberships. An existing account with no organization can accept a new organization invitation. Existing Platform Admins, unverified addresses, privileged organization members, and multi-organization identities require separate review.
- Managed client accounts have one assigned organization. Access edits change client role and topics. A tenant transfer or a move between platform and client roles requires a separate migration of the person's access and owned resources.
- The directory reports pending, active, and suspended states. Review the delivery status before retrying. **Resend or retry invitation** reconciles an interrupted send with Clerk and replaces a confirmed pending invitation. If the send is still in progress, reload after the delivery attempt completes or its five-minute lease expires. Invitations outside this workflow may require manual review in Clerk.
- A Clerk-hosted acceptance becomes active in AskSocial when the recipient next opens the workspace. The server validates the verified recipient and provisioning marker, plus the organization membership for client invitations. The organization activation screen opens the assigned organization when it is not active in the current session.
- Suspension blocks access to AskSocial on subsequent protected requests, including requests from an existing Clerk session. Restore access through User Management. The signed identity remains in Clerk and AskSocial keeps its data and audit history. The platform prevents an administrator from suspending their own managed account.
- Platform audit events capture the actor, target account, delivery outcome, role, state, and topic changes. Invite URLs, passwords, and access tokens are excluded from audit records.

## Release verification

Run `npm run test:user-provisioning` and `npm run build`. The provisioning suite exercises the actual SQL migration in PGlite and uses local Clerk fixtures for invitation delivery and proof checks.

Before release, perform an end-to-end smoke test with a disposable Clerk and Supabase pairing. Accept a new client invitation from a test mailbox, verify an expired link is rejected and can be replaced, and verify direct signup is rejected. Open the assigned organization and check that an unauthorized topic and a different organization are denied. Recheck with an already-open session after a role downgrade and after suspension. Confirm managed Platform Admin activation and explicit PV grants, and inspect the audit chain. Validate Clerk API limits with representative workspace traffic because managed access checks use live identities and memberships.

## Production rollout runbook

Apply this runbook only during a separately approved production change window. Keep User Management closed to operators until the database, Clerk configuration, and app release have passed verification.

### Prepare the release

1. Record the approved app commit and artifact, previous stable artifact, production HTTPS origin, expected Clerk production issuer, Supabase project reference, and owners for deployment and rollback. Build from the reviewed commit in a clean checkout. Use the provisioning release branch and review its diff against its parent. The feature commit includes both provisioning migrations and the database permission acceptance test. Record any separately approved changes before including them in the same rollout.
2. Compare the approved migration manifest against the target migration history during the change window. Use the same migration order and a representative Supabase schema and API-role configuration in the rehearsal. Stop for unexpected migration drift, missing prerequisites, or unrelated pending migrations outside the approved release. Rehearse the exact candidate with `npm run test:user-provisioning`, `npm run test:production`, `npm run lint`, and `npm run build`. Also run `supabase/tests/provisioning_privileges_acceptance.sql` on the disposable Supabase-profile database after both provisioning migrations. The default provisioning suite applies the first migration, so it does not by itself validate the permission hardening.
3. Capture the current Clerk signup and invitation settings, the Supabase third-party provider configuration, and the current database restore point. Confirm that a recovery operator can use the hosting, Clerk, and Supabase consoles independently of the application. Identify any existing workflows that depend on open signup or on any current token provider before the cutover.

### Apply the changes in order

1. **Supabase schema.** Apply `202611180001_admin_user_provisioning.sql` followed by `202611180002_restrict_provisioning_privileges.sql` through the existing migration runner. Include required earlier migrations in the reviewed manifest if the target is behind. The first migration adds the provisioning state and audit RPCs, an organization column on chat sessions, and organization-scoped topic grants. Existing topic grants keep the empty organization scope, and existing chats retain a null organization. Confirm both versions in the migration history and verify the effective permissions before proceeding. RLS must be enabled on the provisioning and topic-grant tables. `service_role` can read provisioning rows and execute `change_user_provisioning`; provisioning writes go through that audited RPC. `authenticated` can read only the permitted topic-grant columns and rows. Confirm existing API-role permissions against the reviewed release, including service-role writes to the existing topic-grant table.
2. **Supabase token trust.** Enable the native Supabase integration on the production Clerk instance. Confirm a refreshed Clerk session has the expected issuer, `sub`, `role: authenticated`, and `o.id` when an organization is active. In Supabase Auth, add the Clerk third-party integration for that production issuer. Verify that the project accepts a fresh production Clerk session token through the publishable-key path. Review the existing `authenticated` grants and RLS for resources exposed through Supabase APIs before adding trust. Keep the service-role key on the server and use the session token with the publishable or legacy anon key for scoped queries. The integration uses Clerk signing keys and ordinary session tokens. [Supabase Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk)
3. **Clerk signup.** Set the production instance to **Invite-only**. Verify enabled Organizations, Account Portal, verified email and the approved credential setup. Check the return to the production app after acceptance and sign-in. Verify that `org:member` cannot invite or manage members in Clerk, and disable automatic domain enrollment for managed client organizations. If Supabase Auth registration is unused, keep it disabled. Use controlled release test identities, leaving existing users and assignments in place. [Clerk access modes](https://clerk.com/docs/guides/secure/restricting-access)
4. **App cutover.** Set the environment variables listed above for the approved production pairing. `ASKSOCIAL_APP_ORIGIN` must match the production HTTPS origin exactly. Run `npm run preflight` with the reviewed target environment after the schema is in place. Smoke test the new artifact before allowing active use. Cut over all serving instances and drain older instances before sending any managed invites. Use existing Platform Admin authorization for initial operator access. Keep PV Compliance entitlements and ODCS reviewer approvals in their existing workflows.

### Verify before opening User Management

- Confirm existing sign-in, legacy topic access, and existing workspace activity. Confirm uninvited signup is denied and a non-Platform Admin cannot open User Management or call its API.
- Use approved synthetic users, two test organizations, and a controlled inbox. Provision a user, verify email delivery and hosted activation, and confirm the assigned topic is visible, an unassigned topic is denied, and the other organization is denied. Check both the application routes and Supabase with the recipient's Clerk session and publishable key. Confirm that a request presented without an accepted Clerk token cannot read the granted rows.
- Downgrade an existing test session to Viewer and confirm writes are denied. Suspend it and confirm subsequent protected requests and scoped reads are denied with the same session. Verify resend replaces the old invitation and that audit entries attribute changes to the operator without recording credentials or links. Natural expiry and resend have already passed in disposable Clerk and Supabase, using a one-day test invitation. Production invitations are seven days.
- Confirm provisioning does not grant PV Compliance or reviewer access. Record the release and migration IDs, results, and owner approval. Stop the rollout on any unexpected allow or deny, signup failure, missing audit event, or error that compromises tenant isolation. Check application, Clerk, and Supabase logs for auth, RLS, invitation, and RPC failures during the cutover.

### Roll back safely

1. **Contain immediately.** Stop managed provisioning and invitation sends. Block the User Management page and API at the serving layer if available. If isolation, role enforcement, or suspension fails, take affected protected routes out of service. Record the cutover time, affected accounts and invitation IDs, app version, and last successful migration. Keep Invite-only in effect during containment.
2. **App rollback before first managed invitation or enrollment.** Restore the previously verified app artifact after checking that it works with the migrated schema and current Clerk settings. Leave the additive schema and permission hardening in place by default. Restore an earlier configuration value only when that specific setting caused the incident and the recovery owner verifies the resulting access controls. Restoring open signup requires separate approval.
3. **App rollback after managed invitations or enrollment.** Keep managed users behind an app build that enforces organization boundaries, roles, and suspension. If such a build is unavailable, keep affected protected routes in maintenance mode until the fix is verified. The pre-feature artifact does not enforce those managed states. Reconcile outstanding invites against Clerk and the audited provisioning record before resending or revoking anything. Preserve account states, topic grants, and audit history.
4. **Token trust or database incident.** If a newly added Clerk issuer must be removed, first isolate dependent routes because managed reads require that issuer. Preserve existing providers and verified RLS policies. For a failed migration, inspect committed schema and migration history before retrying, and rehearse the recovery on a disposable copy. Prefer a reviewed forward fix for schema or permission problems. A database restore can lose writes after the restore point and does not roll back Clerk users or invitations. Use point-in-time recovery only under incident approval, with a write pause and reconciliation of Clerk state, assignments, and audit history before reopening.
5. **Verify recovery.** Confirm legacy sign-in, direct signup denial, managed-role and suspension enforcement, cross-tenant denial, and the audit trail before re-enabling User Management or invitation sends.
