# AskSocial staging acceptance

## Required setup

1. Deploy the selected rollback bookmark from `codex/platform-enhancement-roadmap-2026-07-31`.
2. Apply the Supabase migrations in timestamp order:
   - `202607170001_create_theme_knowledge_store.sql`
   - `202607310001_create_platform_persistence.sql`
   - `202607310002_create_saved_intelligence_library.sql`
   - `202607310003_create_continuous_intelligence.sql`
3. Configure all variables in `.env.example`, including a unique `ASKSOCIAL_CRON_SECRET`.
4. Grant the staging user `platform_core`, `module_patient`, `agent_patient_journey_advisor`, and the required intelligence capabilities.
5. Keep `ASKSOCIAL_KNOWLEDGE_MODE=stateless` until Knowledge Store persistence is explicitly validated, then switch staging to `persistent` for snapshot testing.

## Rollback bookmarks

| Commit | Staging capability |
| --- | --- |
| `9840aed` | Three-layer platform baseline |
| `75614ea` | Persistent workspace and governed-record foundation |
| `3ab181b` | Citation and source-verification experience |
| `9d4c174` | Workspaces, saved searches, saved prompts, cross-workspace search |
| `2e58fd0` | Medical Aesthetics Patient Intelligence |
| `797dce1` | Continuous Intelligence, alerts, and delivery outbox |

## UI/UX acceptance flows

### Shared workspace

- Create a workspace from the header and confirm it remains selected.
- Start a new conversation and confirm the session remains attached to the workspace.
- Ask a Medical Aesthetics question and confirm the answer is saved as a searchable work product.

### Evidence and citations

- Confirm every analytical answer displays Sources & verification when evidence is available.
- Confirm valid URLs open in a new tab.
- Confirm source-linked, source-identified, and context-only records are visually distinct.
- Confirm the disclosure does not imply independent authentication.

### Intelligence library

- Search across persisted work products and confirm records from unauthorized modules or tenants never appear.
- Save a search and confirm it appears in Library.
- Save a prompt, select it, and confirm AskSocial opens with the prompt populated.

### Patient Intelligence

- Open the Patient module with Medical Aesthetics selected.
- Generate Patient Intelligence and inspect journey, barriers, emotions, unmet needs, recommendations, and evidence.
- Confirm limited patient/caregiver coverage and machine-label limitations remain visible.
- Confirm a `patient_intelligence` work product is created in the selected workspace.

### Continuous Intelligence

- Create a weekly monitor with in-app delivery and run it manually.
- Confirm a baseline monitor result and report-distribution entry are created.
- Run against a changed corpus or controlled fixture and confirm the configured threshold creates an alert.
- Confirm email, Slack, and Teams remain queued until their connectors are configured.
- Call the cron route without the secret and confirm it returns `401`.

### Regression and accessibility

- Confirm existing Executive Brief, theme prevalence, longitudinal tracking, theme relationships, and strategic implications remain visible.
- Test keyboard navigation, focus visibility, mobile layout, empty states, loading states, and failure messages.
- Run the authenticated staging smoke test before production promotion.
