# GLP-1 corpus

GLP-1 uses the shared AskSocial corpus pipeline with a dedicated ingestion profile,
ranking profile, and eight-theme taxonomy. Its canonical identifier is `glp_1` and
its display name is `GLP-1`. `glp1` and `GLP 1` resolve to the same corpus.

## Source

- Supplied export: `GLP-1 - Oct 20, 2026 - 12 20 18 PM.csv`.
- Repository source: `data/glp-1.csv`, copied without modification.
- SHA-256: `937c80bf2ade6d10cde9cc412f60a61f493f811efd0e45adee32cd2799cd17bb`.
- Encoding: UTF-16LE with BOM, tab-delimited, 49 columns and 5,000 source rows.
- Three source rows have no URL. Missing links are not fabricated.
- The export is multilingual (2,135 rows are labeled English). Raw languages and
  source metadata are preserved. The current keyword profiles are English-oriented;
  this integration does not claim validated multilingual recall or translate text.
- Standard relevance filtering currently retains 3,134 analytical findings.
  The retained set is not a count of patients, clinical outcomes, or safety reports.

## Functionality

The shared pipeline supports AskSocial search, citations, all eight intelligence
modes, themes, knowledge snapshots, executive briefs, longitudinal analysis,
Patient Intelligence, and the six specialist intelligence modules. Modules use the
core GLP-1 corpus with their existing contextual evidence selection. Shared saved
intelligence, workspace, reports, and monitoring workflows retain topic scoping.
Existing deployment tracing includes the CSV for search, module, patient, and
monitoring endpoints.

Injection references using “shot” or “jab” are retained when otherwise relevant.
Topic context is required, and promotional or unrelated content is filtered.
Source text is evidence, not application instructions.

## Registration and verification

Apply `supabase/migrations/202610200001_register_glp_1.sql` to each target database.
It registers the active topic and follows the existing corpus rollout policy by
assigning it to users who already have topic access. Admins see active topics
automatically; future users follow the existing topic assignment workflow.
Deploy the code and CSV together with this database registration.

On October 20, 2026, the equivalent registration and access upserts were applied
through the service API to the locally configured Supabase environment. The active
topic and access for all five existing assigned users were verified. This does not
mark the SQL migration as applied in Supabase migration history; the migration is
idempotent and remains safe to run through the normal deployment workflow.

Run `npm run test:glp-1` to verify source integrity, aliases, filtering, all modes,
specialist modules, patient audience resolution, executive intelligence, knowledge
snapshots, longitudinal tracking, and corpus cache isolation.

## Separate PV workstream

The separate [GLP-1 PV implementation](pv/glp-1-pv-compliance.md) now provides an
FDA reference snapshot, a draft detection library, and governed social screening.
It requires library approval before screening and does not establish regulatory
readiness or ODCS qualification. Tolerability themes in conversational intelligence
remain social analysis, not an adverse-event determination.
