# AskSocial E2B(R3) alignment implementation summary

## 1. Architecture

AskSocial now follows this governed flow:

`social evidence → PV detection → versioned structured case → human review → versioned client notification / sponsor handoff`

The active manifest selects immutable mapping and notification packages. The structured-case assembler reuses the existing PV record, adverse-event ontology, ICH E2D(R1) patient/reporter identifiability review, review decision, and transfer record. It adds a canonical E2B-aligned view, field evidence, special situations, non-destructive case relationships, independent audit timestamps, and four validation states.

Every transfer payload contains the complete aligned snapshot, client-notification payload, mapping version, email mapping version, ICH package/guide/code-list versions, and an explicit statement that it is not a regulatory-submission-ready ICSR. The audit event retains the same version and validation metadata.

## 2. E2B mapping

The active package evaluates AskSocial-applicable fields in:

- C: administrative identifiers, report type/receipt dates, reporter/source, literature, and study data.
- D: patient identifiers/characteristics, age, sex, measurements, history, and death data.
- E: repeating reaction/event verbatim, language, MedDRA, seriousness criteria, dates/duration, outcome, confirmation, and country.
- F: repeating tests/procedures and results.
- G: repeating drug roles, products/substances, dose/regimen, dates, lot, form, route, indication, action, causality, rechallenge, and additional drug information.
- H: evidence-grounded narrative, reporter comments, and sender-owned content.

Fields that belong to the pharmaceutical company or regulatory sender are explicitly marked client-system and are never manufactured by AskSocial. FDA regional data is isolated as a pending client/regional package rather than mixed into ICH core logic.

The complete table is in [the field-mapping specification](./e2b-r3-field-mapping.md). The authoritative runtime source is `config/pv/e2b-r3/mappings/asksocial-e2b-r3-2026.01.0.json`.

## 3. AskSocial-only fields

AskSocial-only fields include the AskSocial Case ID, source URL/platform/verbatim and evidence hash, field-level provenance, extraction/model/prompt versions, reviewer identity, source publication, collection, algorithm assessment, review start/completion, escalation and notification timestamps, classification, validation status, and duplicate/follow-up relationships. These are operational/audit data and are not represented as official E2B elements.

## 4. Client email fields

The active email package exposes these sections and fields:

- Case Identification: AskSocial Case ID, client account, product/brand, source publication/collection time, platform, URL, and explicit location.
- Source / Reporter: reporter type, reporter and patient identifiability statuses, and HCP status.
- Patient: age/group, sex, relevant history, and other supported characteristics.
- Suspected Product(s): repeating structured product data.
- Reaction / Event(s): repeating structured event data.
- Special Situations: only when flagged.
- Case Narrative: factual, evidence-grounded narrative.
- Original Source Evidence: verbatim, URL, platform, and publication time.
- PV Assessment: classification, detected/missing minimum criteria, seriousness/special-situation flags, causality-statement status, and human-review status.
- Audit Trail: collection, algorithm, human-review, and escalation timestamps.

Empty optional sections are omitted. Clinically meaningful unknowns display only where configured. Reporter/patient PII, prompts, and internal confidence values are excluded by default. All source content is HTML-escaped, and the disclaimer is client-configurable through the versioned email package.

## 5. Human review

External notification requires governed human review where clinically or regulatorily significant ambiguity exists. Mandatory triggers include serious/fatal/hospitalised/life-threatening/disabling/congenital/medically important events, pregnancy/pediatric exposure, overdose, misuse/abuse, medication errors, off-label use with adverse outcome, ambiguous identifiability, conflicting product/event facts, MedDRA suggestions, uncertain product matching, and possible duplicate/follow-up relationships.

AskSocial retains suggestions and confidence but never silently converts them into validated coding, seriousness, causality, official identifiers, or final reportability.

## 6. Regulatory verification required

- Confirm the client/region rule that determines C.1.4 first receipt in an ODCS/social-listening workflow.
- Configure and qualify the client sender identifiers, worldwide identifiers, first-sender rules, and expedited-reporting determination.
- Implement and validate a licensed MedDRA version and human coding workflow.
- Create an FDA regional package tied to the exact receiving environment and current AEMS rules before any FDA E2B transformation.
- Approve client privacy, evidence-retention, source-capture, Day Zero, and notification rules by jurisdiction.
- Perform qualified PV/regulatory review of the mapping and validation logic before production activation.

## 7. Limitations

AskSocial provides an E2B(R3)-aligned safety-intelligence intake and triage structure. It is not, by virtue of this implementation alone, a validated pharmacovigilance safety database or regulatory ICSR transmission system.

No ICSR XML generation, regional validator integration, regulatory gateway transmission, acknowledgment parsing, or submission-ready claim is implemented. `regulatorySubmissionReady` is structurally fixed to `false`.

## Version update procedure

1. Place the new authoritative artifacts in the regulatory evidence review process and record their publication/version dates.
2. Copy the active mapping/email package to a new immutable versioned file.
3. Update only changed fields/code-list references and mark unresolved items `REGULATORY VERIFICATION REQUIRED`.
4. Add/update tests for changed rules and run the complete PV and production suites.
5. Obtain qualified PV/regulatory approval.
6. Register the immutable package in `src/lib/pv/e2b/config.ts` (required for deterministic serverless bundling), change the active manifest pointer, and deploy the related migration/configuration together. No field rule or code-list value belongs in the registry.
7. Preserve older packages so historical transfer snapshots remain reproducible.

## Deployment dependency

Apply `supabase/migrations/202609150001_add_versioned_e2b_alignment.sql` before deploying code that creates new PV records, completes reviews, or transfers cases. The migration adds independent algorithm/escalation/notification timestamps, records mapping versions on reviews/transfers, and creates the non-destructive relationship ledger.
