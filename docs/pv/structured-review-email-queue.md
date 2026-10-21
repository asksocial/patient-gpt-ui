# Structured Review and R3 email queue

Scope A refinement, requested October 20, 2026. Original implementation baseline: `dd78048`. Changes are isolated on `codex/icsr-structured-email-queue`; the main workspace's expanded PV/ODCS/GLP-1 work is preserved.

## User workflow

1. Open a source mention in Structured Review. Complete patient/reporter verification, individual minimum criteria, classification, and clinical assessment. Additional clinical details, source evidence corrections, concomitants and approved coding documentation are edited in the same review. Initial/Follow-up remains separate from spontaneous/solicited report origin. Multiple products/events are entered on separate lines.
2. Prepare the case summary. Inspect source facts, human additions, missing information, narrative and labelled human interpretations. Corrections invalidate that preview. Attest and complete Structured Review once. No email is sent by completion.
3. The case enters Reviewed Cases & Email. All completed reviews remain in the paginated queue; incomplete/non-ICSR reviews remain visible and ineligible as complete ICSRs. Earlier separate-panel approvals require current Structured Review completion before eligibility. Original extraction and full snapshots remain in read-only Structured Review history.
4. Select up to ten eligible cases across queue pages. Compose and edit recipients, subject and plain-text content. Preparation persists an immutable preview and a single combined PDF. Each case begins on its own page; long cases use explicitly labelled continuation pages rather than clipping or dropping evidence. Source text unsupported by the PDF's font is visibly represented by Unicode code-point notation.
5. Inspect/download the PDF and its case page ranges. Changes to selection or email content invalidate the prepared draft. Prepare it again before sending. Original source evidence and reviewed clinical details are included; internal notes and provisional case-level PV notes are excluded. Approved structured seriousness/expectedness/causality interpretations are separately labelled as human assessments, never substituted for source facts.
6. Explicitly confirm the recipients, content and attachment, then send. RESEND_API_KEY and PV_SPONSOR_FROM_EMAIL must be configured for in-app delivery. Otherwise copy the email and download the PDF for the approved external channel; after actual sending, record the recipients and external message reference with a separate sent attestation.
7. Provider acceptance, external-send attestation and sponsor acknowledgment are distinct. An uncertain provider result or failed finalization blocks another send and further correction until an operator reconciles the retained batch with provider evidence. No automatic retry, scheduler or regulatory transmission is introduced.

## Data and safeguards

- Existing `pv_reviews` remains the canonical review. `complete_pv_structured_review` atomically stores that review, its approved R3 snapshot, append-only revision history, lifecycle changes and audit event. Record timestamp and ICSR revision checks reject stale saves. Review evidence gates remain server-side.
- The approved case stores `structuredReviewId`. Queue preparation binds to that exact latest review and case revision. The former ICSR PATCH mutation route returns 409 directing users to Structured Review. Legacy sponsor send-all requests are blocked; segregated QA export/testing remains available.
- `pv_icsr_email_batches` stores immutable recipient/content/PDF bytes and case/version/page/hash manifests. Direct anon/authenticated access is revoked and RLS enabled. Authenticated application routes enforce the existing PV entitlement and principal filters, with private/no-store responses.
- A transaction claims the preview once, rechecks case revisions and readiness and excludes overlapping pending batches. A stable provider idempotency key is tied to the batch. Transfer records and provider outcomes commit atomically; the UI never treats provider acceptance as sponsor receipt.
- Source evidence, original extraction, human corrections, reviewer/time and changed field paths remain retained. PDF downloads are audited and do not mark notifications as sent.
- Existing reviewed medical history and clinician-authored narrative survive consolidation unless explicitly replaced. Product/event arrays are matched by reviewed value/evidence when possible, rather than carrying clinical detail across reordered entries.

## Deployment prerequisites

Apply `supabase/migrations/202610200002_structured_review_email_queue.sql` with the matching code after the original ICSR migration and required baseline PV migrations. Apply the migration transactionally and reconcile migration history. Do not apply the deferred ODCS/background/GLP-1 migrations as part of this change.

Before any live change, confirm the staging project and inspect its current audit/write schema. A staging database already running deferred ODCS restrictions is not assumed compatible with the baseline branch. Establish a compatible staging target or separately reviewed compatibility change first.

The implementation branch is `codex/icsr-structured-email-queue`; the owner-confirmed Vercel override is on `codex/icsr-email-release`. After migration compatibility and candidate review, integrate the isolated commit into that existing Preview branch to reuse the verified staging configuration. If deploying the new branch directly instead, explicitly configure its Preview URL/key pair and staging Clerk settings first. No credentials are copied into this checkout, and no production change, live migration or real email is performed by local checks.

Rollback must retain clinical history and email batches. Do not return to an application build that can blindly resend a pending or accepted batch. Reconcile sending/uncertain batches before a rollback or follow-up deployment.

## Validation

- `npm run test:pv-structured-email`: canonical review, clinical corrections, missing criteria, original-extraction preservation, stale previews, multiple products/events, coding guard, report pagination and internal-information exclusion.
- `npm run test:pv-email-db`: isolated PostgreSQL migration execution and transactional rollback, stale saves/drafts, tenant restrictions, direct-user denial, overlapping send exclusion and provider-state persistence. It reads no secrets and contacts no external database or email service.
- Both are included in `test:production`. Run lint, TypeScript and build after changes. `preflight:pv-icsr` now checks the private batch store as well.
- Local database assertions are serial execution, not proof of real multi-connection contention or deployed Clerk authorization. Staging HTTP/concurrency, desktop/mobile/keyboard behavior, manual-send and provider tests using approved synthetic recipients, inbox receipt, and qualified PV approval remain release gates.

Local validation recorded: full `test:production` suite passed; targeted case/PDF and isolated database tests passed after subsequent focused changes; TypeScript and production build passed. ESLint reported no errors and one pre-existing WorkspaceShell navigation warning. Browser/deployed acceptance has not been performed for this candidate.

## PDF case-sheet template

The case-sheet design follows the owner-provided `ICSR Sample PDF.pdf`: teal section rules, subject and identification header, four minimum-criteria cells, patient/product/event columns, then labelled narrative and evidence rows. The QA-only cover and historical sample values are not reused for reviewed-case notifications. Reviewer corrections and qualified PV interpretations retain separate labels. All missing-value states, reviewed clinical details, assessment disclaimer and review provenance remain visible. A concise case fits one sheet; long evidence, multiple products/events and long URLs flow onto labelled continuation sheets, with each subsequent case starting a fresh page. No clinical content is truncated to force a one-page result. This is an application template change only; no additional migration is required.
