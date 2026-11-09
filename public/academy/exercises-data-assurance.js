/*
 * AskSocial PV Academy — interactive exercise content, modules 13–19 (operating model and sponsor assurance).
 * Each module turns its assessed worksheet into written answers with a model answer and a self-marked
 * checklist, plus scored items on the same scenario. Invented content only.
 */
(function () {
  var X = window.pvExercises = window.pvExercises || {};
  var B = window.pvxBuild, C = B.C, M = B.M, O = B.O, R = B.R, I = B.I;

  // ------------------------------------------------------------------ Module 13
  var S13 = ['Scenario: a sponsor asks you to add Drug B in French from a new forum, starting tomorrow. Neither the source nor the language is in the approved schedule.'];
  X[13] = {
    title: 'Scope change worksheet',
    intro: 'Work through the scope-change worksheet for the module scenario: draft the pending coverage row, assemble the evidence and approvals, and plan interim handling.',
    items: [
      I('Coverage row', S13, M('Which fields must the proposed coverage row contain?', ['Product and aliases', 'Market', 'Language', 'Source and dataset boundary', 'Effective dates and schedule version', 'Reviewer names copied from the sales proposal', 'A promise to detect every event on the internet'], [0, 1, 2, 3, 4], 'Coverage is an approved combination of product, market, language, source boundary and dates. It is bounded, never “everything online”.')),
      I('Interim mention', S13.concat(['Before approval, a reviewer happens to see a French post on the new forum describing a rash after Drug B.']), C('What happens to that post?', ['Discard it because the forum is not in scope yet', 'Route it through the agreed exception process and record it', 'Start routine review of the forum, because one post proves the need'], 1, 'Scope uncertainty is never permission to discard. Encountered safety information follows the exception route, and routine review waits for approval.')),
      I('Worksheet 1', S13, R('Draft the proposed coverage row and identify the missing metadata.', 'Proposed row (status: pending, not active): product Drug B (aliases to be confirmed by the sponsor); market to be confirmed; language French; source: the new forum (URL and sub-forums to be defined); dataset boundary: posts from the activation date, collection method to be defined; schedule version to be assigned on approval. Missing: market and territory, the alias list, the source’s terms and lawful-access basis, collection method, review frequency, transfer fields, and the effective date.',
        ['Marks the row pending, not active', 'Covers product, market, language, source boundary and dates', 'Lists the specific missing metadata', 'Does not infer the market from the language alone'])),
      I('Worksheet 2', S13, R('Name the approval roles and list the evidence needed for language, source access and capacity.', 'Approvals: sponsor PV (scope request and applicability), the AskSocial PV lead (activity classification and rules), Operations (capacity and coverage), Engineering (collection method and technical effects) and Privacy (data protection review). Evidence: assessed French competence for named reviewers; the forum’s terms and the lawful-access basis; a tested collection method; capacity modelling for the expected volume; and training and validation completed before activation.',
        ['Names more than one approver, including sponsor PV and the AskSocial PV lead', 'Gives evidence of language competence', 'Gives evidence of source access and lawfulness', 'Gives capacity, training or validation evidence'])),
      I('Worksheet 3', S13, R('Describe interim handling, and how old and new scope versions stay traceable.', 'Until approval, routine review of the forum does not start. Any safety information already encountered is routed through the exception process and logged. The current schedule version stays in force. The new row gets a new version number with an effective date on approval, and the old version is preserved, not overwritten. Transition batches are reconciled so every item can be traced to the scope version in force when it was reviewed.',
        ['Says routine review waits for approval', 'Routes encountered safety information via the exception process', 'Preserves the old version and versions the new one', 'Reconciles items to the version in force at review'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 14
  var S14 = ['Scenario: at 22:00 the scheduled primary is unavailable. The backup has not accepted the period, and a possible serious event is approaching its transfer deadline.'];
  X[14] = {
    title: 'Uncovered shift worksheet',
    intro: 'Complete the coverage-gap worksheet: record the incident with the original times, describe the escalation routes without inventing targets, and verify relief and recovery.',
    items: [
      I('Escalation order', S14, O('Order the actions.', ['Record the time the primary was found unavailable', 'Page the approved backup and the manager route', 'Identify clocks at risk, starting with the possible serious event', 'Obtain explicit acceptance from the relief responder', 'Record containment and notify the sponsor contact if required', 'Reconcile any contingency work after cover is restored'], 'Find the gap, escalate, protect the most urgent clock, get explicit acceptance, document, then reconcile.')),
      I('Model B', null, C('What does Model B mean?', ['24/7 human screening of every mention', 'Continuous automation with on-call human escalation and routine human review on an agreed calendar', 'Automation only, with no human review'], 1, 'Model B is not a statement that humans screen every hour. Each layer needs its own targets and evidence.')),
      I('Worksheet 1', S14, R('Create the incident and handover records with the original times.', 'Incident: 22:00 (UTC and local time recorded) — the scheduled primary is unavailable; the backup has not accepted. Affected: a possible serious event, identified at [original time], deadline [original deadline]. Actions, with times: backup paged 22:02, manager paged 22:05, backup accepted 22:14. Handover record: incoming owner, outstanding cases, original deadlines (unchanged), urgent concerns and receipt exceptions, and explicit acceptance with a timestamp.',
        ['Records the original times; nothing reset', 'Identifies the at-risk case and its original deadline', 'Records explicit acceptance with a timestamp', 'Lists outstanding cases and exceptions in the handover'])),
      I('Worksheet 2', S14, R('Describe the backup, manager, engineering and sponsor routes, without inventing response targets.', 'Backup: the distinct qualified backup named in the on-call schedule for this interval, reached by the approved paging method. Manager: the on-call manager route if the backup does not acknowledge. Engineering: the engineering on-call route if a system issue caused or worsens the gap. Sponsor: the contact listed in the agreement for coverage incidents, used when the procedure requires notification. Response times are whatever the approved schedule and agreement state; I would not make them up.',
        ['Names all four routes', 'Ties each route to the approved schedule or agreement', 'Explicitly avoids inventing response targets', 'Notes when the sponsor notification applies'])),
      I('Worksheet 3', S14, R('Show how you would verify relief acceptance and reconcile contingency work.', 'Verify that the relief responder is qualified and authorized for this sponsor and duty on the date, and get their explicit acceptance of the named cases and deadlines in the handover record. Once cover is restored, compare the contingency queue with the main queue: every item gets a disposition, an owner and proof of receipt for any transfers. Original clocks are preserved, and any missed deadline is recorded as a deviation.',
        ['Checks the relief’s authorization, not just availability', 'Requires explicit acceptance of named items', 'Reconciles the contingency queue item by item', 'Preserves clocks and records deviations'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 15
  var S15 = ['Scenario: a reviewer’s account still works, but their qualification for the assigned sponsor expired yesterday. The queue is growing.'];
  X[15] = {
    title: 'Named authorization worksheet',
    intro: 'Complete the authorization worksheet: what the record must contain, who does what, and how restriction and reinstatement work.',
    items: [
      I('What authorizes?', null, M('Which of these, on their own, authorize independent screening for a sponsor?', ['An enabled system account', 'Academy practice completion at 100%', 'A current, approved, duty-specific named authorization for that sponsor', 'Seniority in the team'], [2], 'Only the named authorization authorizes. Accounts and practice flags are not credentials.')),
      I('Expired qualification', S15, C('What do you do with the reviewer’s queue?', ['Let them continue until the end of the week', 'Reassign the work to an authorized reviewer and start restriction and remediation under the procedure', 'Edit the expiry date to tomorrow'], 1, 'An expired authorization means the duty stops. Never edit records to create a qualification.')),
      I('Worksheet 1', S15, R('List the fields and evidence needed in the named authorization record.', 'Person and authenticated account; duty scope (screening, QC, on-call, leadership or administration, each separate); client, product, market, language and procedure versions covered; evidence: approved learning plan, controlled assessment results (for example the 40-question exam and 120 unseen mentions), supervised practice log, client-specific training; assessor and approver identities; effective date, expiry or next review; restrictions.',
        ['Separates duty scopes', 'Covers client, product, language and procedure version', 'Lists the assessment and supervised-practice evidence', 'Includes effective and expiry dates and the approver'])),
      I('Worksheet 2', S15, R('Identify the assessor, approver and access implementer as separate responsibilities.', 'The assessor is a competent designated person who evaluates the evidence and observed performance. The approver is an authorized PV or Quality person who decides on the authorization. The access implementer changes system permissions to match the approved scope. They are kept separate so that nobody, including the trainee, can assess, approve and grant their own access.',
        ['Defines the assessor role', 'Defines the approver role', 'Defines the access-implementer role', 'Explains why they are separated (no self-qualification)'])),
      I('Worksheet 3', S15, R('Document the restriction, the queue reassignment and the conditions for reinstatement.', 'Restriction: screening duties for this sponsor suspended from the expiry date, with access changed accordingly; historical attribution for past reviews preserved. Reassignment: open items moved to a named authorized reviewer with their original deadlines. Reinstatement: requires current evidence (refresher training and assessment as the procedure defines) and a documented approval; access is restored only after approval.',
        ['Restricts the specific duty and access', 'Reassigns work with the original deadlines', 'Preserves historical attribution', 'Requires evidence and approval before reinstatement'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 16
  var S16 = ['Scenario: a proposed client asks whether it already has audit rights, because AskSocial’s training website describes sponsor audits. The agreement is still unsigned.'];
  X[16] = {
    title: 'Agreement readiness worksheet',
    intro: 'Complete the readiness worksheet: find the missing schedules and owners, write a factual reply, and list what blocks activation.',
    items: [
      I('Audit rights', S16, C('Does the proposed client have contractual audit rights now?', ['Yes, because the website describes audits', 'No; rights need executed terms in a signed agreement', 'Yes, once the screening work starts'], 1, 'Training content and drafts create no enforceable rights. Only executed terms do.')),
      I('Activation blockers', S16, M('Which of these block activation of the affected scope?', ['No agreed transfer deadline schedule', 'No owner for incident and CAPA duties', 'Retention terms not agreed', 'The transfer destination not accepted by the sponsor', 'The sponsor prefers email over the portal'], [0, 1, 2, 3], 'Missing owners, clocks, retention or destination acceptance block the affected scope. A channel preference is something to agree on, not a blocker.')),
      I('Worksheet 1', S16, R('Identify the missing agreement schedules and their decision owners.', 'Missing or incomplete: the scope schedule (products, markets, languages, sources) — sponsor PV with the AskSocial PV lead; timing and deadlines — sponsor PV with AskSocial Operations; coverage model — Operations; transfer destinations and technology — Engineering with sponsor IT and PV; privacy and retention — Privacy and legal on both sides; incident and CAPA duties and audit rights — Quality on both sides; subcontractors and exit — Legal and Quality. Signature authority is confirmed for each party.',
        ['Lists several specific schedules', 'Assigns a decision owner to each', 'Includes audit rights and incident/CAPA terms', 'Mentions signature authority'])),
      I('Worksheet 2', S16, R('Draft a factual reply that separates proposed terms from executed rights.', 'Thank you for asking. The sponsor audit arrangements described in our training materials are proposed terms. Audit rights become enforceable only once they are set out in an executed quality agreement. Our agreement is currently in draft and unsigned, so no audit rights exist yet. We have sent the draft agreement and its schedules for authorized review, and we will confirm the audit terms, including routine and urgent access routes, once they are agreed and signed.',
        ['States clearly that no rights exist before execution', 'Calls the training content proposed or illustrative', 'Makes no unsupported service promise', 'Gives the next step (authorized review of the draft)'])),
      I('Worksheet 3', S16, R('List the activation blockers and the evidence needed to remove each one.', 'Unsigned agreement — executed version with an effective date, signed by the authorized signatories. Blank timing schedule — an agreed and approved deadline schedule. No incident/CAPA owner — named owners in the agreement. Retention not agreed — a retention and legal-hold schedule. Destination not accepted — the sponsor’s receiving acceptance evidence. Procedures not reconciled — a reconciliation record covering the agreement, the service order and the procedures.',
        ['Pairs each blocker with specific evidence', 'Includes the executed agreement and effective date', 'Includes the sponsor’s destination acceptance', 'Includes reconciling the agreement with the procedures'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 17
  var S17 = ['Scenario: a verified sponsor asks for last quarter’s reviewer qualifications and one case’s complete transfer history. The file shows provider acceptance but no sponsor acknowledgement.'];
  X[17] = {
    title: 'Audit request worksheet',
    intro: 'Complete the audit-support worksheet: track the request, gather the right evidence, and handle the missing receipt honestly.',
    items: [
      I('Which qualification?', S17, C('Which qualification record supports the historical case?', ['The reviewer’s current qualification', 'The qualification that was valid when the review took place', 'Any qualification the reviewer has ever held'], 1, 'Trace the case to the authorization in force at the time of review.')),
      I('Missing receipt', S17, C('How do you handle the missing sponsor acknowledgement?', ['Create an acknowledgement record dated at the time of dispatch', 'Disclose the gap, open an investigation and track it to closure', 'Leave the case out of the release'], 1, 'Never backdate or fabricate records, and never hide gaps. Disclose and investigate.')),
      I('Worksheet 1', S17, R('Build a request tracker with item owners and due times.', 'Request ID; requester verified (name, sponsor, basis: agreement clause); scope and period (last quarter); items: (1) reviewer qualifications for the period — owner: Quality, due [date]; (2) full transfer history for case [ID] — owner: Operations, due [date]; (3) investigation of the missing acknowledgement — owner: Quality, due [date]. Coordinator assigned. Release approval, release date and receipt are logged for each item.',
        ['Records requester verification and basis', 'Lists each item with an owner', 'Gives each item a due time', 'Includes a release and receipt log'])),
      I('Worksheet 2', S17, R('List the records you need and the qualification date you must verify.', 'Original source and scope row at the time; reviewer identity and the authorization valid on the review date (verify effective and expiry dates against that date); original clock and timestamps; decision record; package versions; dispatch attempts; provider acceptance; sponsor technical receipt or business acknowledgement (missing); reconciliation records; the procedure versions in force.',
        ['Traces from source through to reconciliation', 'Checks authorization against the review date', 'Includes package versions and provider acceptance', 'Identifies the missing acknowledgement explicitly'])),
      I('Worksheet 3', S17, R('Describe privacy review, release approval, gap handling and how the finding is closed.', 'Before release, check accuracy, relevance and privacy (redacting other sponsors’ data), and label any exports or reconstructions honestly. Release goes through the approved channel after approval by the coordinator or Quality, with what was released and its receipt logged. The missing acknowledgement is disclosed with the investigation status. The finding records the root cause and corrective action, and closes only when implementation and effectiveness are verified and approved.',
        ['Protects other sponsors’ data', 'Labels reconstructions and exports honestly', 'Discloses the gap rather than hiding it', 'Closes only on verified effectiveness'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 18
  var S18 = ['Scenario: a fictional final authority revision changes how an in-scope digital activity is handled. It takes effect in three months. The next annual scope review is six months away.'];
  X[18] = {
    title: 'Regulatory change worksheet',
    intro: 'Complete the change worksheet: register the source accurately, map its impacts, and plan implementation before the effective date. The annual review stays a separate control.',
    items: [
      I('Timing', S18, C('When do you start the change assessment?', ['At the annual scope review in six months', 'Now, so implementation is approved before the effective date', 'On the effective date'], 1, 'Do not wait for the annual review when a change has a deadline.')),
      I('Source states', null, C('A source is a draft consultation. How is it recorded?', ['As an effective requirement', 'With its actual status, plus an impact and planning decision', 'It is ignored until it becomes final'], 1, 'Consultation, final publication and effective requirement are different states. Record which one applies.')),
      I('Worksheet 1', S18, R('Record the source status, jurisdiction, version and dates.', 'Source register entry: authority and jurisdiction; document title and version; status: final (published); publication date; effective date (three months from now); transition provisions, if any; applicability: in-scope digital activity [name], pending sponsor PV confirmation; last checked [date]; next check [date].',
        ['Records jurisdiction and version', 'Records the status as final, not draft', 'Records publication and effective dates', 'Notes that applicability is pending sponsor PV confirmation'])),
      I('Worksheet 2', S18, R('Map the impacts to procedures, scope, clocks, agreements, technology and training.', 'Procedures: update the screening and transfer SOPs for the activity. Scope: check whether the activity classification changes. Clocks: confirm any day-zero or deadline changes. Agreements: assess whether the schedules need amendment with the sponsor. Technology: collection or transfer changes and validation. Training: a focused training delta for affected reviewers. Privacy: re-assess if data handling changes.',
        ['Covers procedures and scope', 'Covers clocks and agreements', 'Covers technology or validation', 'Covers training'])),
      I('Worksheet 3', S18, R('Create the owners, milestones, interim controls and closure evidence, and set the annual review separately.', 'Owners for each impact area (PV lead, Operations, Engineering, Quality, Training); milestones that finish before the effective date (for example SOP approval at month 2, training at month 2.5); an approved temporary instruction if full implementation risks running late; closure evidence of implementation and effectiveness. The annual scope review stays on its own schedule with its own record. Staff refresher training is not a substitute for it.',
        ['Assigns owners', 'Sets milestones before the effective date', 'Includes an interim control or temporary instruction', 'Keeps the annual scope review separate'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 19
  var S19 = ['Scenario: the provider accepted package v2, but the sponsor has not acknowledged it. The only receipt record names v1. The transfer dashboard shows “sent”.'];
  X[19] = {
    title: 'Transfer discrepancy worksheet',
    intro: 'Complete the transfer worksheet: separate the evidence layers, run the discrepancy controls, and define what must be tested before an integration goes live.',
    items: [
      I('Evidence layers', S19, O('Order the evidence layers for one package.', ['Package prepared and approved (v2)', 'Dispatch attempt logged', 'Provider acceptance', 'Sponsor technical receipt', 'Sponsor business acknowledgement', 'Reconciliation against expected package IDs and versions'], 'Each layer is separate evidence. Provider acceptance does not prove sponsor receipt.')),
      I('What it proves', null, C('What does provider acceptance prove?', ['That the sponsor received and accepted the case', 'That the provider accepted the dispatch, not necessarily sponsor receipt', 'That the clock can stop'], 1, '“Sent” and provider acceptance are not sponsor receipt. Investigate before closing.')),
      I('Worksheet 1', S19, R('Build a timeline separating dispatch, provider acceptance and sponsor receipt.', 'v1: prepared [time]; dispatched [time]; provider accepted [time]; sponsor receipt recorded [time]. v2 (correction): prepared and approved [time]; dispatched [time]; provider accepted [time]; sponsor technical receipt: none recorded; business acknowledgement: none. The original clock from day zero is unchanged. The dashboard’s “sent” status is noted as dispatch only.',
        ['Separates v1 and v2', 'Separates dispatch, provider acceptance and sponsor receipt', 'Keeps the original clock unchanged', 'Does not treat “sent” as receipt'])),
      I('Worksheet 2', S19, R('Identify the discrepancy, investigation, retry or alternate-route, and duplicate controls.', 'Open a discrepancy: v2 has no sponsor receipt and the only receipt names v1. Investigate with the sponsor, through the approved contact, whether v2 arrived, before resending. If it is not received, retry through the approved route or the documented alternate route, referencing v2 as a correction of v1 so the sponsor does not create a duplicate. Escalate if overdue. Record each attempt, error and receipt against the exact package version.',
        ['Opens a discrepancy record', 'Investigates before any resend', 'Uses an approved retry or alternate route', 'Applies duplicate control (correction linked to v1)'])),
      I('Worksheet 3', S19, R('List the mapping, access, recovery and receiver-acceptance tests needed before the integration is activated.', 'Mapping: field and code-list versions, required fields, null handling. Access: an unauthorized-access attempt is rejected, and test and production destinations are separate. Recovery: outage, retry and peak-load tests, and failed and wrong-version transfers. Receiver acceptance: the sponsor confirms receipt and processing of test packages, with critical failures resolved and intended-use acceptance documented. Synthetic results alone are not enough.',
        ['Covers mapping and null handling', 'Covers access control and environment separation', 'Covers failure and recovery tests', 'Requires sponsor receiver acceptance'])
      )
    ]
  };
})();
