# AskSocial → ICH E2B(R3) field-mapping specification

## Scope and regulatory posture

AskSocial is an E2B(R3)-aligned safety-intelligence intake and triage layer. It does not generate or submit a regulatory ICSR and it does not determine final reportability or medical causality. The responsible pharmacovigilance organisation remains accountable for case processing, follow-up, validation, regional requirements, and submission.

The active configuration is selected by `config/pv/e2b-r3/manifest.json`. Activated mapping and email packages are immutable. Updating an ICH/FDA package therefore requires adding a new versioned file, validating it, and changing the manifest pointer. No regulatory identifier, controlled term, or null handling is embedded in UI logic.

Verified source baseline:

- ICH E2B(R3) package 1.11, published January 2026.
- ICH ICSR Implementation Guide 5.03, dated 18 July 2025.
- ICH bilingual controlled-terminology set 2.11.
- FDA Regional Implementation Guide and Core/Regional Business Rules, April 2024.
- No default MedDRA version. Each client must configure a licensed version before validated coding is externalized.

## Data separation

1. Regulatory E2B(R3) data lives under the administrative, reporter, patient, reactions, drugs, tests, and narrative structures. Official sender/worldwide identifiers remain client-system fields.
2. AskSocial workflow metadata lives under audit, evidence, relationships, classification, review, and validation. It is retained but never mislabeled as an E2B field.
3. Client notification data is selected independently by the versioned email configuration. It omits PII fields, internal prompts, and empty sections by default.

## Master mapping

This table is generated from the active machine-readable package. Full descriptions, allowed values, conditions, evidence rules, labels, and notes are in `config/pv/e2b-r3/mappings/asksocial-e2b-r3-2026.01.0.json`.

| AskSocial field | E2B element | Authority | Requirement | Capture/finalization | Unavailable handling | Email | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| administrative.askSocialCaseId | — | AskSocial-only | required | derived | block record creation | always | verified |
| administrative.senderCaseId | C.1.1 | ICH | required | client-system + review | omit from AskSocial notification; blocks E2B-export-ready | never | verified |
| administrative.messageCreatedAt | C.1.2 | ICH | required | client-system | not_applicable before transformation | never | verified |
| administrative.reportType | C.1.3 | ICH | required | human-reviewed + review | unknown; use verified CL2 handling only during transformation | conditional | verified |
| administrative.firstReceivedAt | C.1.4 | ICH | required | derived + review | unknown; blocks E2B-export-ready | conditional | pending |
| administrative.mostRecentInformationAt | C.1.5 | ICH | required | derived + review | unknown; blocks E2B-export-ready | never | verified |
| administrative.additionalDocumentsAvailable | C.1.6.1 | ICH | required | human-reviewed + review | false only when reviewer confirms none; otherwise unable_to_determine | conditional | verified |
| administrative.expeditedCriteria | C.1.7 | ICH | required | client-system + review | NI only when allowed by active rule package | never | verified |
| administrative.worldwideCaseId | C.1.8.1 | ICH | required | client-system + review | omit; blocks E2B-export-ready | conditional | verified |
| administrative.firstSender | C.1.8.2 | ICH | required | client-system + review | omit; blocks E2B-export-ready | never | verified |
| relationships.previousCaseIdentifiers | C.1.9.1.r.2 | ICH | conditional | human-reviewed + review | omit when no previous transmission is known | never | verified |
| relationships.linkedReportIds | C.1.10.r | ICH | optional | human-reviewed + review | omit | conditional | verified |
| reporter.title | C.2.r.1.1 | ICH | optional | direct + review | not_reported; transform to nullFlavor only under active business rules | never | verified |
| reporter.givenName | C.2.r.1.2 | ICH | optional | direct + review | not_collected or redacted | never | verified |
| reporter.familyName | C.2.r.1.4 | ICH | optional | direct + review | not_collected or redacted | never | verified |
| reporter.organisation | C.2.r.2.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| reporter.country | C.2.r.3 | ICH | conditional | human-reviewed + review | unknown; apply nullFlavor only if permitted | conditional | pending |
| reporter.qualification | C.2.r.4 | ICH | required | human-reviewed + review | unknown under verified C.2.r business rule | conditional | verified |
| reporter.primaryForRegulatoryPurposes | C.2.r.5 | ICH | conditional | human-reviewed + review | omit until confirmed | never | verified |
| source.literatureReference | C.4.r.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| study.registrationNumbers | C.5.1.r.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| study.name | C.5.2 | ICH | optional | direct + review | not_reported | conditional | verified |
| study.type | C.5.4 | ICH | conditional | human-reviewed + review | unknown only under verified CL8/business rule | conditional | verified |
| patient.initials | D.1 | ICH | required | direct + review | not_reported internally; transform only under active rules | never | verified |
| patient.dateOfBirth | D.2.1 | ICH | optional | direct + review | not_collected or redacted | never | verified |
| patient.age | D.2.2a | ICH | conditional | human-reviewed + review | not_reported | conditional | verified |
| patient.ageUnit | D.2.2b | ICH | conditional | normalized + review | blocks use of age value | conditional | verified |
| patient.ageGroup | D.2.3 | ICH | optional | human-reviewed + review | not_reported | conditional | verified |
| patient.weightKg | D.3 | ICH | optional | derived + review | not_reported | conditional | verified |
| patient.heightCm | D.4 | ICH | optional | derived + review | not_reported | conditional | verified |
| patient.sex | D.5 | ICH | optional | human-reviewed + review | unknown; use verified nullFlavor if transformed | conditional | verified |
| patient.medicalHistory | D.7.2 | ICH | conditional | human-reviewed + review | not_reported | conditional | verified |
| patient.deathDate | D.9.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| reactions[].verbatim | E.i.1.1a | ICH | optional | direct + review | not_reported; prevents complete ICSR classification | always | verified |
| reactions[].language | E.i.1.1b | ICH | conditional | derived + review | unknown; blocks E2B-export-ready for that event | never | verified |
| reactions[].meddraVersion | E.i.2.1a | ICH | required | client-system + review | do not emit MedDRA code; blocks E2B-export-ready | conditional | verified |
| reactions[].meddraCode | E.i.2.1b | ICH | required | human-reviewed + review | pending human coding; blocks E2B-export-ready | conditional | verified |
| reactions[].seriousness.death | E.i.3.2a | ICH | required | human-reviewed + review | NI only under verified rule | conditional | verified |
| reactions[].seriousness.lifeThreatening | E.i.3.2b | ICH | required | human-reviewed + review | NI only under verified rule | conditional | verified |
| reactions[].seriousness.hospitalisation | E.i.3.2c | ICH | required | human-reviewed + review | NI only under verified rule | conditional | verified |
| reactions[].seriousness.disability | E.i.3.2d | ICH | required | human-reviewed + review | NI only under verified rule | conditional | verified |
| reactions[].seriousness.congenitalAnomaly | E.i.3.2e | ICH | required | human-reviewed + review | NI only under verified rule | conditional | verified |
| reactions[].seriousness.medicallyImportant | E.i.3.2f | ICH | required | human-reviewed + review | NI only under verified rule | conditional | verified |
| reactions[].onsetAt | E.i.4 | ICH | optional | human-reviewed + review | not_reported | conditional | verified |
| reactions[].endAt | E.i.5 | ICH | optional | human-reviewed + review | not_reported | conditional | verified |
| reactions[].duration | E.i.6a | ICH | conditional | derived + review | not_reported | conditional | verified |
| reactions[].outcome | E.i.7 | ICH | required | human-reviewed + review | 0 Unknown | always | verified |
| reactions[].medicalConfirmation | E.i.8 | ICH | optional | human-reviewed + review | not_reported; do not default false | conditional | verified |
| reactions[].country | E.i.9 | ICH | optional | human-reviewed + review | not_reported | conditional | verified |
| tests[].date | F.r.1 | ICH | conditional | direct + review | unknown under verified rule | conditional | verified |
| tests[].name | F.r.2.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| tests[].result | F.r.3.4 | ICH | conditional | direct + review | not_reported | conditional | verified |
| drugs[].role | G.k.1 | ICH | required | human-reviewed + review | unknown; blocks E2B-export-ready | always | verified |
| drugs[].productNameReported | G.k.2.2 | ICH | required | direct + review | not_reported; prevents complete ICSR classification | always | verified |
| drugs[].activeIngredient | G.k.2.3.r.1 | ICH | optional | derived + review | not_reported | conditional | verified |
| drugs[].dose | G.k.4.r.1a | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].doseUnit | G.k.4.r.1b | ICH | conditional | normalized + review | blocks use of dose value | conditional | verified |
| drugs[].therapyStartAt | G.k.4.r.4 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].therapyEndAt | G.k.4.r.5 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].batchLotNumber | G.k.4.r.7 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].dosageText | G.k.4.r.8 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].doseForm | G.k.4.r.9.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].route | G.k.4.r.10.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].indication | G.k.7.r.1 | ICH | optional | direct + review | not_reported | conditional | verified |
| drugs[].actionTaken | G.k.8 | ICH | optional | human-reviewed + review | unknown only under verified code-list rule | conditional | verified |
| drugs[].causalityAssessments | G.k.9.i.2.r.3 | ICH | optional | human-reviewed + review | not_reported | conditional | verified |
| drugs[].rechallenge | G.k.9.i.4 | ICH | optional | human-reviewed + review | unknown under active code list | conditional | verified |
| drugs[].additionalInformationCodes | G.k.10.r | ICH | optional | human-reviewed + review | omit | conditional | verified |
| narrative.caseNarrative | H.1 | ICH | required | human-reviewed + review | not_reported; blocks E2B-export-ready | always | verified |
| narrative.reporterComments | H.2 | ICH | optional | direct + review | omit | conditional | verified |
| narrative.senderComments | H.4 | ICH | optional | client-system + review | omit | never | verified |
| audit.sourcePublishedAt | — | AskSocial-only | required | direct | unknown; never substitute another timestamp | always | verified |
| audit.collectedAt | — | AskSocial-only | required | derived | block governed ingestion | always | verified |
| audit.algorithmAssessedAt | — | AskSocial-only | required | derived | block classification audit completion | always | verified |
| audit.humanReviewStartedAt | — | AskSocial-only | conditional | derived | remain blank before review begins | conditional | verified |
| audit.humanReviewedAt | — | AskSocial-only | conditional | derived | remain blank until completion | always | verified |
| audit.escalatedAt | — | AskSocial-only | conditional | derived | remain blank until escalation | always | verified |
| audit.clientNotifiedAt | — | AskSocial-only | conditional | derived | remain blank when only a draft/export was prepared | never | verified |
| evidence[] | — | AskSocial-only | required | derived | block externalization of unsupported regulatory values | never | verified |
| administrative.fdaRegionalData | — | FDA | N/A | client-system + review | not_applicable in AskSocial intake | never | pending |

## Minimum case criteria and classifications

The reviewer evaluates one identifiable patient, one identifiable first-hand reporter, a suspect medicinal product, and a reaction/event. A missing criterion never causes automatic deletion.

| Classification | Use |
| --- | --- |
| `potential_icsr_complete` | All four minimum criteria are human-supported. This still is not a final reportability decision. |
| `potential_icsr_incomplete` | Product/event relevance is present but at least one minimum criterion is missing or unresolved. |
| `pv_relevant_non_icsr` | Safety-relevant health experience retained outside the AE/ADR review queue. |
| `special_situation` | Configured exposure/use/product circumstance requiring appropriate review; not automatically reportable. |
| `insufficient_information` | Evidence is too limited for a stronger classification but remains retained. |
| `not_pv_relevant` | Human review closed the record as Not Reportable; evidence and audit history remain. |
| `requires_human_review` | Ambiguous or conflicting evidence cannot be resolved automatically. |

Special situations supported by the model include medication error, misuse, abuse, overdose, occupational exposure, pregnancy/breastfeeding exposure, off-label use, lack of efficacy, product quality with AE, infectious transmission, unexpected benefit, pediatric exposure, and drug interaction.

## Missing information

AskSocial preserves `not_reported`, `unknown`, `not_applicable`, `unable_to_determine`, `ambiguous`, `conflicting`, `redacted`, and `not_collected` as distinct internal states. Conversion to an official nullFlavor is performed only when the active, verified ICH/regional rule explicitly permits it. The application does not invent or globally default nullFlavor codes.

## Evidence and provenance

Each extracted regulatory candidate can retain the field path, value, extraction type, source span, URL/platform, publication and collection times, confidence, model/prompt version, reviewer, review time, mapping version, and regulatory-verification status. Verbatim source language is never overwritten by normalized or coded terminology. Machine-suggested MedDRA terms are distinct from human-validated codes and require a configured MedDRA version.

## Independent audit timestamps

| Timestamp | Meaning |
| --- | --- |
| `sourcePublishedAt` | When the source author originally published the content. |
| `collectedAt` | When AskSocial acquired/ingested the content. |
| `algorithmAssessedAt` | When automated classification completed. |
| `humanReviewStartedAt` | When the reviewer selected Continue to structured review. |
| `humanReviewedAt` | When the reviewer saved a governed decision. |
| `escalatedAt` | When the reviewer selected escalation for sponsor handoff. |
| `clientNotifiedAt` | When the configured provider accepted an outbound client notification. |

`collectedAt` is only a candidate for E2B C.1.4 under a client-approved receipt-date policy. These values are never overwritten or substituted for one another.

## Human-review matrix

Human review is mandatory before external notification for potential seriousness, death, hospitalisation, life threat, congenital anomaly, disability/incapacity, medically important conditions, pregnancy, pediatric cases, overdose, misuse/abuse, medication error, off-label use with adverse outcome, ambiguous patient/reporter identifiability, conflicting drug/event information, machine-suggested MedDRA coding, uncertain product matching, and possible duplicate/follow-up relationships.

AI may extract verbatim facts, normalize under explicit versioned rules, and propose classifications. It may not silently resolve medical causality, seriousness ambiguity, primary-source status, official case identifiers, MedDRA validation, local expedited criteria, or FDA regional submission fields.

## Duplicate and follow-up handling

Records are linked non-destructively with `possible_duplicate_of`, `confirmed_duplicate_of`, `follow_up_to`, `repost_of`, or `related_case`. Proposed automated links include confidence, rationale, and an evidence snapshot. A reviewer confirms or rejects the link; original source records never merge destructively.

## Validation states

- Schema-valid: the internal record is syntactically usable and retains an evidence reference and collection time.
- PV-triage-valid: sufficient product/event/special-situation evidence exists for human PV review.
- Email-ready: safe, evidence-grounded notification content exists.
- E2B-export-ready: required client identifiers, minimum criteria, human validation, configured terminology, and applicable rules are present for a potential downstream transformation.
- Regulatory-submission-ready is always false in AskSocial.

## Worked examples

### 1. Straightforward AE

- Original mention: “I am a 42-year-old woman. After Product A, I developed swelling.”
- Structured data: one consumer/self reporter, one specific adult patient, Product A, swelling, temporal association.
- Mapping: C.1.3; C.2.r.4; D.2.2a/b; D.5; E.i.1.1a/b; G.k.1; G.k.2.2; H.1.
- Missing: dose, indication, event dates, outcome, validated MedDRA term.
- Classification: `potential_icsr_complete` only after reporter/patient existence evidence is confirmed.
- Review: product/event/identifiability and coding confirmation.
- Email payload: case ID, source/audit data, identifiability statuses, product/event verbatim, missing criteria, review status, disclaimer.

### 2. Serious AE

- Original mention: “My father was admitted overnight after taking Product B.”
- Structured data: first-hand other reporter, one patient relationship, Product B, event requiring clarification, hospitalisation flag.
- Mapping: C.2.r; D; E.i.3.2c; G.k.2.2; H.1.
- Missing: qualifying patient characteristic, clinical event term, dose, outcome.
- Classification: `potential_icsr_incomplete`.
- Review: seriousness and first-hand relationship are mandatory; follow-up needed before complete status.
- Email payload: explicit hospitalisation evidence, incomplete minimum elements, no causal claim.

### 3. Incomplete potential ICSR

- Original mention: “Product C made people feel terrible.”
- Structured data: product and nonspecific event language; aggregate/unclear patient and reporter.
- Mapping: candidate E.i.1.1a and G.k.2.2 only.
- Missing: one identifiable patient, identifiable first-hand reporter, specific event details.
- Classification: `potential_icsr_incomplete` or `requires_human_review`.
- Review: retain and attempt feasible follow-up; do not create official identifiers.
- Email payload: only if configured/approved, with missing criteria and verbatim evidence.

### 4. Medication error special situation

- Original mention: “I accidentally used two doses of Product D but had no symptoms.”
- Structured data: medication error, product, patient/reporter candidates, no AE.
- Mapping: G.k.10.r only after human confirmation against active CL17; no invented E reaction.
- Missing: reaction/event.
- Classification: `special_situation`.
- Review: route appropriately; do not assume reportability.
- Email payload: special-situation section, source evidence, assessment, timestamps, disclaimer.

### 5. Multiple products and events

- Original mention: “While taking Product E with Product F, I developed rash and dizziness.”
- Structured data: two drugs with roles requiring review; two independent reaction verbatims.
- Mapping: repeating G.k blocks and repeating E.i blocks, plus G.k.9.i relationships if assessed.
- Missing: product roles, doses, dates, outcomes, validated MedDRA codes.
- Classification: `potential_icsr_complete` only if all four minimum criteria are confirmed.
- Review: product roles and each drug-event relationship remain separate.
- Email payload: repeating product and reaction arrays; original verbatim preserved.

## Regulatory verification register

- Client/region definition of first receipt for C.1.4 when AskSocial sits between listening source and safety system.
- FDA regional element population, conformance, and transmission rules for the intended AEMS use case.
- Client sender identifiers, worldwide case identifiers, first-sender rules, and expedited-reporting determinations.
- Licensed MedDRA version, coding workflow, and validation authority.
- Client-specific privacy/retention policy for reporter/patient identifiers and source screenshots.
- Client-approved Day Zero and notification policy by source ownership and jurisdiction.
