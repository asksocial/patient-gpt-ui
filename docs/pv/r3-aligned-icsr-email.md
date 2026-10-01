# R3-aligned ICSR review and email

## Existing architecture and extension

PV Compliance lives in `src/components/PvComplianceCenter.jsx` inside the workspace. Existing `/api/pv` routes call `requirePvPrincipal` (authentication plus PV entitlement), then `src/lib/pv/service.ts` with explicit principal predicates using server-only Supabase service-role access. Detection uses the versioned ontology and botulinum recognition pipeline; records preserve original source evidence. Reviews, Day Zero, transfers, screening, sponsor reports and reconciliation have separate workflows. `src/lib/pv/e2b` already assembles aligned evidence cases and configurable sponsor notifications. `pv_audit_events` provides the shared hash-chained ledger.

This extension reuses `getPvRecord`, `assessIcsrIdentifiability` and `buildPvE2bAlignedCase` rather than adding another detector. It provides a typed, source-backed review representation where the existing flexible assembler is insufficient for a per-field review contract. Existing sponsor handoffs and email renderers are preserved. This extension has no SMTP, sending API, XML generation, or regulatory submission transport.

## Files and implementation

| File | Responsibility |
| --- | --- |
| `src/lib/pv/icsr/types.ts` | Versioned TypeScript case, field, criterion, source, approval and email schemas |
| `src/lib/pv/icsr/case.ts` | Adapter, conservative extraction, blank sections, evidence display and attributed narrative |
| `src/lib/pv/icsr/review.ts` | Server-owned allowlist for edits, review/approval gates, email/header validation and changed paths |
| `src/lib/pv/icsr/email.ts` | Deterministic plain-text email with all requested sections; controlled external summary |
| `src/lib/pv/icsr/workflow.ts` | Pure review, approval, preview and manual notification status transitions |
| `src/lib/pv/icsr/service.ts` | Tenant reads, review mutations, atomic revision writes, shared audit integration |
| `src/app/api/pv/records/[recordId]/icsr/route.ts` | Protected GET/PATCH with private no-store responses |
| `src/components/PvIcsrReview.jsx` | Evidence, per-field review, criteria, notes, approval, editable preview, copy/export and sent attestation |
| `src/components/PvComplianceCenter.jsx` | Mounts the review panel in the existing case workbench |
| `supabase/migrations/202610010001_create_pv_icsr_email_reviews.sql` | Additive tenant-scoped state and immutable revision ledger with compare-and-swap RPC |
| `src/test/runPvIcsrEmailQuality.ts` | Cases A–I and safety guards |
| `package.json` | `test:pv-icsr-email` and production-suite inclusion |

## TypeScript contract

The concrete schema is in `types.ts`. The core field and criterion shapes are:

```typescript
type CaseField = {
  value: string;
  availability: 'reported' | 'not_reported' | 'unknown'
    | 'not_available_from_source' | 'requires_review';
  evidence: string;
  confidence: number | null;
  source_reference: string | null;
  origin: 'source' | 'extracted' | 'human_added';
  confirmed: boolean;
};
type MinimumCriterion = {
  present: 'present' | 'potentially_present' | 'not_identified';
  evidence: string;
  confidence: number | null;
  source_reference: string | null;
  confirmed: boolean;
};
```

`R3AlignedCase` has typed identification, patient, reporter, suspect-product array, event array, individual event seriousness evidence, concomitant-product array, medical-history fields, source evidence, narrative, human-only PV assessment, internal notes and server-stamped approval. Every field has an explicit availability state even when empty. Known extraction confidence is preserved; missing confidence is null, not invented. Source includes mention ID, URL, account, platform, timestamps, original excerpt and evidence hash. Reviewer additions/corrections are labeled and remain distinct from the source.

Initial/Follow-up is the local notification lifecycle, not ICH C.1.3 report-source coding. Source-type classification remains a separate downstream mapping concern. A configured market is never copied into patient country. Case-level onset, outcome and seriousness are not copied into multiple events. Machine MedDRA suggestions are excluded; approved coding requires version and documented human coding assessment.

## Extraction, narrative and missing information

The adapter copies products/events from the existing ontology only with evidence found in the original source. Optional clinical values require field-specific supporting evidence. Limited demographic patterns require patient linkage; all remaining information stays empty with `not_reported`. Explicit field values of unknown remain `unknown` rather than absence. Concomitant roles stay separate. The original text is retained even if no eligible clinical fields can be extracted.

Narratives use attributed source quotations and separately display product, indication, patient characteristics, onset, outcome, intervention and important gaps. They never assert product causality. A reviewer edits and confirms the narrative before approval. Seriousness fields describe evidence presence/absence or review needs; absence from the source never means the patient was non-serious. Conditional or negated language is routed to PV review.

## Workflow and UX

Open a potential record through the existing compliance queue and select the R3-aligned review section. The status path is Detected → Requires Review → Reviewed → Email Ready → Sent/Exported. Source evidence and minimum criteria are prominent. Expand a clinical section to inspect/edit each field, missing state and evidence; each field's evidence panel shows its original extraction and linked original source. Missing fields can be reviewed and confirmed as missing. Add additional product, event or concomitant rows after saving outstanding changes.

Keep judgments in the separate PV Assessment section. Internal notes and provisional PV assessments are excluded from external summaries and generated emails. Record any additional information in the supporting-evidence box with reviewer-documentation provenance, rather than pretending it came from the original post.

Save the review, then approve it. Approval requires four supported, confirmed minimum criteria, an actual suspect product/event, all fields reviewed, a narrative, report lifecycle confirmation and appropriate coding documentation. Incomplete records remain available under “Potential Safety Signal — Minimum ICSR Criteria Require Review.” They cannot be approved for a complete potential ICSR email. Existing Day Zero/reportability decisions remain in the pre-existing qualified review workflow; this email approval never starts or changes regulatory clocks.

Generate opens a plain-text preview. Edit subject, comma/semicolon-separated recipients and body; save preview edits before copy/export or sent recording. The standardized assessment and submission disclaimer must remain. Copy to the user's approved sharing process, or export the email plus external case summary as JSON. Marking sent requires recipients and explicit attestation that the reviewer actually sent it outside AskSocial. No endpoint transmits data externally.

## Persistence, security and audit

Apply the migration before enabling the panel in a deployed environment. No data backfill is required; cases are assembled on demand, and the immutable original extraction is captured with the first saved revision. Existing record tables and statuses are not modified.

`pv_icsr_cases` stores the latest snapshot; `pv_icsr_case_revisions` stores original extraction, reviewed case, email, field paths changed, action, authenticated reviewer and timestamp for every mutation. Edits always invalidate approval and the current email; old emails remain in history. The UI displays the latest 100 revisions; older history remains retained in the database.

The RPC locks the record, validates tenant ownership and expected revision, protects the original extraction, and commits current state and audit revision together. Concurrent stale writes return HTTP 409. A trigger prohibits revision updates/deletes. RLS is enabled with no public policies; anonymous/authenticated database clients are denied direct access. Only the server service role can execute the write RPC. Routes independently require authentication and the PV entitlement, and every record/history query uses tenant predicates. Existing authorization granularity is preserved; no new reviewer-role policy is invented.

A compact action record is also added to the shared `pv_audit_events` chain after commit. If that secondary append fails, the transactional ICSR ledger still retains the authoritative change; reload to see the committed revision before retrying. This follows existing shared-audit behavior. Source text is rendered as React text or plain-text export, never unescaped HTML. Email headers reject newlines. External URLs are restricted to HTTP(S) in the UI. Review input is field-allowlisted and size-limited; source evidence, approval identity, schema and original extraction are server-owned.

## Future XML boundary

Conceptual downstream groups: identification C.1, primary reporter C.2, patient D, reactions E, medicinal products G, narrative H. The exact E2B element mapping, controlled terminology, null flavors, repeating identifiers, regional rules and XML validation remain a separate representation layer. The existing versioned mapping package is retained for that future work. The intake availability enum is not an asserted HL7 null-flavor mapping. Passing email review validation does not establish XML validity or regulatory submission readiness.

## Validation and test plan

Run `npm run test:pv-icsr-email`, `npm run test:pv-compliance`, `npm run test:pv-e2b-r3`, `npm run test:icsr-e2b-mapping`, TypeScript checking, ESLint and the production build.

New behavioral tests cover A complete reviewed case, B missing patient, C missing reporter, D multiple events, E multiple products, F hospitalization evidence, G reporter causality language, H missing versus explicit unknown clinical data and unsupported evidence rejection, I human correction with original extraction retention and renewed approval. Additional checks cover protected edits/provenance, internal-note exclusion, conditional seriousness, MedDRA omission and header/recipient validation. Migration and route access assertions are structural checks, not live-database tests.

In a migrated staging database, verify authenticated tenant A can review its own case, tenant B receives no case/history, missing entitlement is 403, unauthenticated access is 401, direct anonymous table/RPC access is denied, concurrent saves yield one winner and one 409, original extraction cannot change, revisions cannot be deleted, export download works, and sent requires attestation. Visually exercise expand/edit/confirm/save/approve/preview/copy/export on desktop and mobile. Live migration/RPC/access and browser-authenticated acceptance must be completed before deployment; local unit checks do not prove those integrations.

Reference: [ICH implementation guide hosted by FDA](https://www.fda.gov/media/81904/download), section 3.3.1, for the four minimum elements. The schema is an evidence intake model, not a regulatory submission format.

## Pre-deployment execution record

See [the October 1 checklist](icsr-predeployment-checklist.md) for executed checks, the verified staging migration and SQL acceptance results, dependency audit blockers, and remaining authenticated application acceptance.
