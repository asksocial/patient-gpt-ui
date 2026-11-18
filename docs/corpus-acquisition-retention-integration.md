# Corpus Acquisition retention integration

Implementation is paused at the architecture boundary. This review covers `1056b7d`, the latest committed Corpus Builder foundation on the acquisition lineage. The in-progress engine is outside the review.

## Architectural decisions required

| Area | Committed behavior | Decision needed |
| --- | --- | --- |
| Raw expiry | Page ingestion expires revision text from collection time and the immutable protocol duration. Reobservation can shorten the shared revision deadline. Native post IDs, URLs and author keys have separate storage. The existing expiry path starts when any revision expires and deletes all revisions' text and details, clears the native ID, and invalidates at record scope. | Approve the unit of expiry and field-level dispositions. Agree on revision-scoped expiry, repeat acquisition and the treatment of existing corpus versions. |
| Operational audit | The workspace audit chain includes actor IDs and is protected by immutable triggers. A writer allocates its next sequence from the last stored event. Page checkpoints and usage records support recovery and budget accounting. | Confirm which records the 90-day window covers. A separate expiring operational log requires an approved basis and schedule for the existing chain. Pruning the chain requires an agreed verification and sequence continuity protocol. |
| Field allowlist | Page ingestion projects typed fields into tables after hashing the entire input page. Replay compares the full-page digest. Frame construction uses observation details in its digest and eligibility. | Agree on the normalized field allowlist and the projection point before persistence or logging. Preserve replay for already checkpointed pages and verify how optional fields affect frozen frames. |
| Apify deletion | The dataset key is part of reservation replay identity. The committed interface has no durable signal that all consumers have finished with a dataset. | Define who may release a dataset and how release accounts for shared references, checkpoint completeness and recovery. |

## Proposed interface requirements

- Bind the provisional 30-day raw and 90-day operational audit defaults to a versioned policy and persist effective deadlines. Approve the clock origin, effective date, existing-data treatment, protocol overrides, and disposition of text, URLs, native IDs, author keys, observations and digests.
- Provide workspace-scoped reads that enforce expiry and withdrawal at query time regardless of scheduler progress. Apply the same deadlines to future exports, indexes and caches. The committed frame checks already enforce revision-text availability.
- Use an atomic, bounded local cleanup operation under the existing workspace mutation lock. Give the scheduler a narrowly scoped capability and define cadence, retry and audit expiry. Record a minimal deletion event in the cleanup transaction. Preserve the acquisition approval, budget and recovery contracts.
- Make external deletion a separately authorized operation keyed by provider account or project and dataset ID. Require a durable release signal, persist deletion intent and acknowledge completion, and reconcile retries after interrupted calls. An authoritative already-absent result for the verified scope counts as success. Use a fake provider during development.

## Unresolved data-rights and privacy approvals

- Source-by-source collection, storage, processing, reuse and sharing rights, including platform terms and restrictions on sensitive personal data.
- The provisional durations, clock origins, retroactivity and exceptions for holds or mandatory recordkeeping.
- The field allowlist and retention of native IDs, URLs, pseudonymous author keys, digests and deletion evidence.
- Takedown and data-subject request handling across derived artifacts, logs, replicas, backups and restored copies.
- Apify processing terms, account ownership, storage regions or transfers, provider retention, deletion authority and deletion guarantees.

## Synthetic checks pending agreement

Cover exact expiry boundaries, delayed cleanup, mixed-age revisions, allowlist projection, retries, workspace isolation, configurable windows, atomic deletion auditing and preservation of approval, budget and checkpoint replay. Use a fake provider for duplicate releases, shared and recoverable datasets, already-absent outcomes, authorization failures and interrupted deletes. Synthetic validation remains pending because implementation stopped at the architectural conflicts.
