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
  source metadata are preserved. Audience classification now includes English,
  Korean, Japanese, Portuguese, Spanish, French, German, and Chinese personal
  experience patterns. Keyword themes remain English-oriented. This does not
  establish validated multilingual recall or translate the source.
- Standard relevance filtering now retains 4,737 analytical findings, recovering
  multilingual experiences previously excluded by English-only voice/symptom gates.
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

## Initial audience reanalysis (October 22, 2026, version 1)

The supplied Downloads export matches the repository source byte for byte.
`src/ingestion/glp1Audience.ts` assigns a versioned audience and content designation
to every source record before analytical exclusions. The same classifier supplies
the canonical persona and Patient Intelligence eligibility. Machine-derived
patient/caregiver labels remain **likely**, never confirmed identities.

Across all 5,000 source records:

| Audience | Records |
| --- | ---: |
| Patient | 245 |
| Caregiver | 5 |
| Patient community (personal treatment status not established) | 313 |
| Community observer | 2,227 |
| Media or research | 1,867 |
| Provider/HCP | 80 |
| Company or commercial | 89 |
| Off topic / no supported medication context | 174 |
| Unassigned / unknown audience | 0 |

The patient subset contains 202 likely personal experiences and 43 prospective
patient questions. It represents 4.90% of the full export and 5.17% of the expanded
analytical corpus. The previous simple pipeline retained 46 patient-labeled
records among 3,134 findings; that denominator differs from the revised corpus.
There are 606 patient-related records in the full export (601 in analytics),
including community context, caregiver accounts, reported stories, reposted
speech and five commercially influenced testimonials; this broader count is
not a count of patient authors. No statistically representative population share
or maximum-recall guarantee is established.

Comment records are classified from comment text, using the parent title only
for topic context. “Comment on Dr…” identifies the parent channel rather than
the commenter. Reposts, celebrity speculation, clinic advertising, pharmacy
spam, and Geely Monjaro automotive content do not become patient voices.
Korean subject omission is handled with explicit medication/dosing/journey
signals; medication-forum membership alone yields `patient_community`.

Run `npm run analyze:glp-1-audiences` to regenerate the full labeled CSV, JSONL
audit, and summary under `artifacts/glp-1-audience-analysis/`. The CSV preserves
all 49 original columns and adds audience, designation, patient-related flag,
eligibility, heuristic confidence, matched evidence, rationale, review status,
analytical inclusion, classifier version and source row. Source rows excluded
from analytics remain labeled in this export. The original CSV is unchanged.

All patient/caregiver labels require human validation. Remaining general
community records may include patients whose role is not evident in the export;
their designation describes the available content rather than asserting a
non-patient identity. Confidence scores are not calibrated probabilities.
Run `npm run test:glp-1-audiences` for recovery, false-positive, source-integrity,
complete-assignment, answer-denominator and cross-workflow consistency checks.

### Initial production release

The October 22 audience release is based on production commit `70ae7c1` and
deploys classifier `glp1-audience-2026-10-22.1` with the existing, unchanged source
CSV. The runtime derives the revised labels during ingestion; replacing the raw
CSV with the audit export is unnecessary and would violate its source schema.
The audience regression is part of `test:production`. The release also updates
the Next.js runtime to 16.4.1 to clear the newly published production dependency
advisories, retaining the established ESLint configuration.

The initial live Patient Intelligence metrics were 250 patient/caregiver records
(245 patient, five caregiver), all in the likely tier, representing 5.3% of the
4,737-finding analytical corpus. All 4,737 findings have explicit audience labels.
Fresh analyses use these rules; previously saved briefs retain their historical
snapshots. No corpus registration, access-policy, or PV database migration is
required for this audience update.

## Persona segmentation (October 22, 2026, version 2)

Classifier `glp1-audience-2026-10-22.3` replaces the broad Community Observer
designation with independent **audience/source role** and **conversation type**
axes. Every record receives exactly one of each. Definitions, evidence basis,
matched source text and previous role are exported for audit. No record has an
unknown audience or conversation designation.

Of the 2,227 former Community Observer records, 185 now have more specific roles:
40 commercial accounts, 30 news/media, 27 additional likely patient diaries,
21 market commentators, 20 care services, 19 wellness/nutrition creators,
16 healthcare professionals, six family/peers, four health educators, one research
account and one advocacy organization. The remaining 2,042 have conversation
classifications while their speaker role is unstated. One former professional
record also becomes public discussion because its role evidence was insufficient.

The retained corpus remains 4,737 findings:

| Audience / source group | Posts |
| --- | ---: |
| General public discussion, broken out by conversation type | 2,043 |
| News & media | 1,889 |
| Patient support communities | 313 |
| Patients & prospective patients | 272 |
| Health educators & commentators | 53 |
| Companies & commercial accounts | 47 |
| Clinics, pharmacies & care services | 33 |
| Healthcare professionals | 32 |
| Market & investment commentators | 21 |
| Wellness, nutrition & fitness creators | 20 |
| Family & peers | 6 |
| Caregivers | 5 |
| Research & scientific organizations | 2 |
| Advocacy & patient organizations | 1 |

There are 26 nonempty conversation types across the retained corpus. Public
discussion has 19 types, including information requests, treatment outcomes,
administration/dosing, comparisons, affordability, safety, policy, research,
news sharing, legal discussion, appearance, humor and brief reactions. Broader
medication discussion remains explicit when a narrower classification is
unsupported. Content labels do not imply professional credentials.

Healthcare roles require explicit clinical credentials or practice language.
A bare “Dr.” title becomes health educator/commentator because a doctorate
alone does not establish a clinician. Commenters do not inherit parent-channel
roles; replies exclude hit sentences copied from the parent title. Reposts do not establish personal treatment use. Family labels require treatment context, and celebrity fan language does not establish a personal relationship. Family/peer stories
remain separate from supported caregiving. Recovered Japanese treatment diaries
remain likely patient evidence. The Patient Intelligence subset is now 277
likely patient/caregiver records (272 patient and five caregiver).

Persona Intelligence exposes all role groups with post counts, percentages,
leading conversation types and expandable original-source examples showing the
classification evidence. Public conversation types have their own detailed
table. In the initial version 2 release, both tables used selected findings as the denominator; the public
table is a subset of the role table and must not be added to it. Percentages use
two decimals so small groups remain visible. Theme-first answers and small
samples also receive the breakdown. Figures describe sample composition rather
than population prevalence or unique people.

Regenerate the CSV/JSONL/summary with `npm run analyze:glp-1-audiences`. The CSV
preserves all 49 source fields and adds 17 audit fields, including readable role
and conversation labels, role evidence and its basis, and previous role. The
legacy designation is retained for traceability.

## Full source corpus composition (October 22, 2026 correction)

Persona Intelligence now uses **all 5,000 original source rows**, independently
of answer intent, intelligence mode, and the renderer's 50-finding evidence cap.
The earlier 50-post percentages were composition of a ranked shortlist and were
incorrect for the requested corpus-level breakdown. `loadGlp1PersonaIntelligence`
classifies every raw row before exclusions and supplies that independent summary
to both ordinary and theme-first answer rendering. The API preserves it.

The full source export has 15 audience/source groups (including the 174 off-topic
records) and 27 conversation designations. All audience rows sum to 5,000 and
shares use 5,000. The 4,737 retained records continue to support thematic analysis;
263 excluded records remain visible and designated in the composition. Their
inclusion in the composition does not add them to the thematic evidence set.

The broad **patient-related content** group is explicitly displayed as a separate
content lens that overlaps audience rows, with 639 posts (12.78% of 5,000):

| Patient-related content category | Posts | Share of full corpus |
| --- | ---: | ---: |
| Likely personal treatment experiences | 229 | 4.58% |
| Prospective-patient questions | 43 | 0.86% |
| Likely caregiver experiences | 5 | 0.10% |
| Patient support-community context | 313 | 6.26% |
| Media-reported patient stories | 20 | 0.40% |
| Reposted patient accounts | 8 | 0.16% |
| Commercially influenced patient testimonials | 5 | 0.10% |
| Family, peer or other third-party patient references | 16 | 0.32% |
| **Total patient-related content** | **639** | **12.78%** |

The likely patient/caregiver voice subset remains 277 posts (5.54% of the full
source corpus, 5.85% of the retained analytical corpus). The broader content group
is not a count of patient authors. The initial audience release documented 606
patient-related posts (including 563 patient/caregiver/community posts); subsequent
segmentation recovered additional patient diaries and relationship context.
Those records were not deleted when the role categories were separated. Of the
current 639 patient-related posts, 634 are retained and five commercial testimonials
are excluded from thematic analytics. The downloadable audit still covers all
5,000 source records unchanged.

Regression coverage calls `askSocial` end to end under multiple intents and
checks the full denominator, all-row count reconciliation, off-topic visibility,
patient-content reconciliation and independence from the ranked evidence limit.
Historical saved answers retain their original snapshots; new analyses use the
corrected full-corpus composition.

## Six client-facing audience groups (October 22, 2026)

The default view answers “Whose voice is this?” with six closed, expandable
audience groups and one separate closed exclusion bucket. The original 15
nonempty granular designations remain visible as subtypes with their original
counts, shares, conversation types, classification evidence and source links.
General Public's 19 conversation types appear inside its drill-down. The same
mapping is used for API summaries, text fallback answers, the UI and audit exports.
Historical summaries containing only granular labels derive the grouping in the UI.

All shares still use the full 5,000-row source corpus, including hidden off-topic
records. No renormalization occurs when exclusions are collapsed:

| Client group | Posts | Share of 5,000 |
| --- | ---: | ---: |
| Patients & Their Circle | 639 | 12.78% |
| Healthcare & Science | 72 | 1.44% |
| Health & Wellness Influencers | 75 | 1.50% |
| Industry & Markets | 140 | 2.80% |
| Media & Advocacy | 1,875 | 37.50% |
| General Public | 2,025 | 40.50% |
| Excluded / Off-topic (separate bucket) | 174 | 3.48% |
| **Total** | **5,000** | **100%** |

Advocacy remains under Media & Advocacy because organizational representation
does not establish a personal patient voice. Clinics and pharmacies remain
under Healthcare & Science as care-delivery organizations; their subtype and
commercial conversation classifications remain explicit. These are grouping
choices, not reclassification of individual source records or credentials.

The six audience groups cover 4,826 posts. The separate exclusion bucket contains
174 off-topic posts. Another 89 spam/promotional records are excluded only from
thematic analytics and retain their source groups in this composition. All patient-related posts now belong to Patients & Their Circle, counted once.

### Combined patient-related group

Patients & Their Circle now combines all 639 patient-related posts (12.78%)
into one group, with no separate patient-content card or patient-content
breakdown. The original 596-post audience set is wholly contained within these
639 records. The additional 43 are 20 media stories, 18 public-discussion posts
and five commercial testimonials. A record's patient-related flag takes priority
over its source role for client grouping, so no post appears in two client groups.

The resulting counts are 639 Patients & Their Circle, 72 Healthcare & Science,
75 Health & Wellness Influencers, 140 Industry & Markets, 1,875 Media & Advocacy,
2,025 General Public and 174 Excluded / Off-topic, totaling 5,000. Patients & Their
Circle expands to combined conversation types and original-source evidence,
without separating patient voices from patient-related context. Original source
roles remain available in audit metadata. Full-corpus saved GLP-1 compositions
are refreshed on read to this grouping when the source denominator matches;
stored messages, historical narrative and other answer sections are unchanged.

The labeled CSV preserves all 49 source columns and now adds 19 audit columns,
including Client Audience Group and Client Audience Group Name alongside the
unchanged granular audience fields. Regression checks assert exclusive mapping,
all-row reconciliation, source-denominator percentages, subtype preservation and
the advocacy/clinic placement decisions.

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
