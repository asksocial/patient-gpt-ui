# Scheduled intelligence scope

Monitor supports keywords, geography, or both. Keywords are comma/newline-separated literal words or phrases, with any/all matching. Geography accepts multiple countries and regions. When both criteria are present, evidence must satisfy both. Blank criteria preserve existing whole-topic monitoring.

Criteria are stored on the profile and applied before analysis by the shared scheduled/manual execution service. Geography uses source-country metadata, not inferred patient residence. Unknown geography is excluded from a geographic scope. Reviews use the available topic corpus; creating a monitor does not provision new source ingestion. An empty result produces no measured signal or decline alert.

## Release setup

1. Apply `supabase/migrations/202611120001_monitoring_scope.sql` before deploying the code.
2. Production uses a Vercel daily cron at `0 9 * * *` (09:00 UTC hour, timing may vary on Hobby). Set a random production `CRON_SECRET` before deployment; Vercel sends it as a bearer token. `/api/cron/monitoring` authenticates it independently of Clerk and processes up to ten active due profiles per invocation. Legacy external schedulers can use `ASKSOCIAL_CRON_SECRET` when `CRON_SECRET` is absent. Cadence due dates use UTC calendar days to avoid skipping days due to scheduler jitter. Monitor failures and overdue profiles; higher volume needs additional scheduler capacity. The release adds only monitoring cron configuration; it does not enable the unrelated local PV worker.
3. External email, Slack and Teams delivery remains queued until its enterprise connector is configured. In-app results use the existing work-product and delivery pipeline.
4. In an authorized test workspace, create a scoped profile, run it, reload to verify persistence, and invoke the authenticated scheduler with a due test profile to verify the same scope appears in its run payload.

## Validation

`tsx src/test/runContinuousIntelligenceQuality.ts` verifies keyword-only, geography-only, combined scope, literal matching, validation, legacy behavior, profile persistence and execution against the real topic loader with a mocked persistence transport. It also verifies that empty results do not create a false decline alert. Missing/incorrect scheduler credentials and authenticated execution are also checked. TypeScript, focused ESLint and the production build pass. The browser preview checks creation and saved scope using the real component with mock API responses; it does not verify live database migration, connectors or deployed scheduling.

Preview evidence: `artifacts/qa/monitoring-scope/monitor-preview.jpg` and `monitor-saved.jpg`.
