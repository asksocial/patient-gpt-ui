# AskSocial production readiness

## Release mode

The default production mode is intentionally stateless:

```text
ASKSOCIAL_KNOWLEDGE_MODE=stateless
```

In stateless mode, analytical snapshots can be generated in memory for the current response, but the knowledge snapshot and comparison APIs return `KNOWLEDGE_PERSISTENCE_DISABLED` without querying an unavailable table.

Do not set the mode to `persistent` until the Knowledge Store migration has been applied and validated in the target Supabase project.

## Analytical coverage

Validated full analytical coverage:

- Regenerative Aesthetics
- Medical Aesthetics
- Hepatitis B
- Gene Therapy

Conversation-only coverage:

- Uterine Fibroids

Uterine Fibroids continues using the existing hybrid answer pipeline. It does not receive prevalence, longitudinal, Knowledge Store, or Executive Intelligence output until a finding-level canonical corpus is approved.

Medical Aesthetics is explicitly approved to reuse `data/regen-aesthetics.csv` with the Medical Aesthetics ingestion profile. Regenerative and Medical Aesthetics therefore share source rows while retaining distinct therapeutic-area identifiers and profile-specific interpretation.

## Entitlements

Entitlements are stored in Clerk public metadata under `askSocialEntitlements` for users and organizations.

Resolution precedence is:

1. Platform defaults
2. Organization grants and denials
3. User grants and denials
4. Administrator override
5. Deployment-level safety overrides

User settings therefore override organization settings. Deployment safeguards can still disable a capability globally, such as Knowledge Intelligence while running statelessly.

Administrators manage capability access at `/admin/entitlements`.

## Required deployment files

The following corpora must be committed and included in the server trace:

- `data/regen-aesthetics.csv`
- `data/HepB_-_Patients__Caregivers - Mar 11, 2026 - 11 47 15 AM.csv`
- `src/ingestion/curated/gene_therapy.json`

`next.config.mjs` explicitly includes the CSV corpora in the `/api/ask` server bundle.

## Required environment variables

See `.env.example`. Never commit real values.

## Release commands

```bash
npm ci
npm run release:check
```

The release check runs linting, production regression tests, an optimized build, a read-only environment/Supabase/corpus preflight, and a production-dependency security audit.

## Staging smoke test

Unauthenticated security and routing checks:

```bash
ASKSOCIAL_STAGING_URL=https://staging.example.com npm run smoke:staging
```

Complete authenticated flow:

```bash
ASKSOCIAL_STAGING_URL=https://staging.example.com \
ASKSOCIAL_STAGING_SESSION_COOKIE='__session=...' \
npm run smoke:staging
```

The authenticated test verifies entitlement resolution, analytical coverage, the hybrid answer contract, and the new analytical response contract.

## Deployment checklist

1. Confirm the three validated corpora are tracked by Git.
2. Configure every required environment variable.
3. Keep Knowledge Store mode stateless unless its migration has been applied.
4. Run `npm run release:check` from a clean checkout.
5. Deploy to staging.
6. Run the authenticated staging smoke test.
7. Verify the Executive Brief UI for a validated therapeutic area.
8. Verify analytical coverage for Medical Aesthetics and conversation-only labeling for Uterine Fibroids.
9. Confirm entitlement grants and denials with non-admin test users.
10. Promote the exact staging commit to production.
