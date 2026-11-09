window.assuranceLessons = [
  {
    id:13, title:'Service scope and portfolio coverage', doc:'ASPV SCOPE 002', owner:'PV Lead and sponsor PV',
    objective:'Determine whether a product, market, language and source combination is approved, and route gaps through controlled change.',
    teaching:[
      'Coverage is an approved combination of product, market, language, source boundaries and dates. It is bounded by the sponsor activity and dataset, rather than a promise to detect every event on the internet. Product aliases, source responsibility, review rules and the effective schedule version must be available to the reviewer.',
      'Before allocating work, compare the mention with the effective scope row and the reviewer’s authorization. A new language or source requires evidence of lawful access, language competence, suitable methods and available capacity. Do not infer market or age from a profile. Missing metadata needs a documented decision.',
      'Log a change request, assess PV, operational, technical and privacy effects, obtain the relevant approvals, then train and validate before expanding routine service. Preserve old scope versions and reconcile transition batches. Safety information already encountered follows the agreed exception route; a scope uncertainty is not permission to discard it.'
    ],
    scenario:'A sponsor asks you to add Drug B in French from a new forum tomorrow. Neither the source nor the language is in the approved schedule.',
    options:['Start routine review because the sponsor requested it','Create a pending scope change, assess access, competence and capacity, and obtain approval before activation','Discard any safety information from the forum'], answer:1,
    feedback:'A commercial request does not approve operational scope. Preserve any encountered safety concern and route it through the agreed exception process while the new scope is assessed.',
    worksheet:['Draft the proposed coverage row and identify missing metadata.','Name the approval roles and list language, source-access and capacity evidence.','Describe interim handling and how old and new scope versions will remain traceable.'],
    output:'Pending scope row, change assessment, interim handling decision and activation evidence list.',
    critical:'Activating unsupported coverage or discarding safety information solely because scope is unresolved.',
    questions:[
      ['What establishes portfolio coverage?',['A sales list of products','An approved, versioned product/market/language/source schedule','Any dataset that has been uploaded'],1,'The scope schedule defines the covered combinations and periods.'],
      ['A source feed fails and supplies no records. What should be recorded?',['Zero safety mentions','A coverage gap with impact and recovery ownership','Successful complete screening'],1,'A missing feed cannot establish that there were no relevant mentions.']
    ]
  },
  {
    id:14, title:'Coverage and out of hours escalation', doc:'ASPV OPS 003', owner:'Operations with PV and Engineering',
    objective:'Handle an uncovered interval, preserve deadlines and transfer responsibility to a qualified available responder.',
    teaching:[
      'The retained design is Model B: continuous automation with on-call human escalation and routine human review on an agreed calendar. It is not a statement that human reviewers screen every hour. Automation, on-call response and routine screening each need their own targets, staffing and acceptance evidence.',
      'Each on-call interval needs an available qualified primary, distinct backup, manager route, engineering route and sponsor contacts. Confirm UTC intervals and IANA time zones, holidays, daylight-saving changes, relief and competing duties. A timezone distribution or a calendar entry alone does not establish coverage.',
      'At handover, the incoming owner explicitly accepts outstanding cases, original deadlines, urgent concerns and receipt exceptions. If the primary is absent or does not acknowledge, page the approved backup and manager, identify clocks at risk and record containment and notification. Preserve timestamps during outages and reconcile the secure contingency queue after recovery.'
    ],
    scenario:'At 22:00 the scheduled primary is unavailable. The backup has not accepted the period, and a possible serious event is approaching its transfer deadline.',
    options:['Assign a trainee and start a new clock','Wait until the next routine shift','Activate the qualified backup/manager chain, obtain acceptance, preserve the clock and record the coverage gap'], answer:2,
    feedback:'An unaccepted shift remains uncovered. Follow the approved escalation chain and sponsor procedure; do not fill the gap with an unqualified person or erase the delay.',
    worksheet:['Create the incident and handover records with original times.','Describe the backup, manager, engineering and sponsor routes without inventing response targets.','Show how you would verify relief acceptance and reconcile any contingency work.'],
    output:'Uncovered-shift incident, accepted handover, deadline impact and recovery reconciliation.',
    critical:'Assigning an unqualified reviewer, resetting a clock or describing Model B as 24/7 staffed review.',
    questions:[
      ['What does Model B mean?',['24/7 staffed human screening','Automation with on-call escalation and scheduled routine review','No human responsibility outside office hours'],1,'Each type of coverage has a separate documented commitment.'],
      ['Who owns open work during an unaccepted handover?',['Nobody until the next login','The outgoing owner until acceptance or documented escalation','The software automatically'],1,'Ownership cannot disappear between shifts; the outgoing owner must retain it or escalate.']
    ]
  },
  {
    id:15, title:'Named reviewer authorization', doc:'ASPV TRN 004', owner:'PV Lead and Quality with a qualified assessor',
    objective:'Verify a person’s current authorization for the assigned client, product, language and duty.',
    teaching:[
      'A named authorization record links the person and authenticated account to assessed competence, current procedures and permitted duties. Screening, QC, on-call, leadership and administration are separate scopes. An enabled account or Academy completion flag does not authorize any of them.',
      'Qualification includes baseline needs, an approved learning plan, controlled assessment, supervised practice, relevant client/product/language training and approval by competent designated personnel. The core plan proposes a 40-question exam and 120 unseen screening mentions; the online quiz and worked examples are preparation. The assurance extension adds observed operating scenarios.',
      'Before assignment, check scope and effective/expiry dates. On a lapse or critical concern, restrict or suspend the duties, reallocate work and implement approved access changes. Preserve historical attribution. Reinstatement requires evidence and approval. Trainees cannot qualify themselves or assume that finishing a practice lesson proves a credential.'
    ],
    scenario:'A reviewer’s account still works, but the qualification for the assigned sponsor expired yesterday. The queue is growing.',
    options:['Allow review because access still works','Route to an authorized reviewer and initiate restriction/remediation under the procedure','Change the expiry date without an assessment'], answer:1,
    feedback:'Access and qualification are distinct controls. Operations reallocates the queue while PV/Quality resolve the qualification and access record.',
    worksheet:['List the fields and evidence needed in the named authorization record.','Identify the assessor, approver and access implementer as separate responsibilities.','Document the restriction, queue reassignment and conditions for reinstatement.'],
    output:'Authorization check, restriction decision, reassignment and remediation record.',
    critical:'Treating browser completion, account access or an edited expiry date as qualification.',
    questions:[
      ['Which item authorizes independent client screening?',['A browser lesson flag','A current approved named duty-specific authorization with evidence','An account invitation'],1,'Verified competence and approved scope must accompany the named authorization.'],
      ['Can a trainee approve their own qualification?',['Yes after passing a quiz','No, a competent designated assessor and approver are required','Yes if they are available overnight'],1,'Availability does not establish assessment authority or competence.']
    ]
  },
  {
    id:16, title:'Sponsor quality agreements and responsibilities', doc:'ASPV QAA 005', owner:'Sponsor and AskSocial PV, Quality and legal signatories',
    objective:'Identify which service commitments require an executed agreement and completed sponsor schedules.',
    teaching:[
      'The quality agreement defines the delegated activities and retained sponsor responsibilities. Complete scope, timing, coverage, destinations, privacy, retention, incident handling and technology schedules. Regulatory accountability is not transferred merely because AskSocial screens a mention or prepares a packet.',
      'Sponsor audit rights need explicit executed terms describing access to relevant records, personnel, systems and subcontractor evidence, with routine and urgent routes. Inspection support needs coordinated contacts and evidence retrieval. An unsigned draft creates neither an enforceable sponsor audit right nor a validated inspection capability.',
      'Before activation, reconcile the quality agreement, service order and procedures. Obtain appropriate signature authority and record the executed version and effective date. Agree incident/CAPA duties, retention and legal holds, service-exit records and subcontractor controls. Missing owners, clocks, retention or destination acceptance block the affected scope. Do not negotiate or sign terms through this practice page.'
    ],
    scenario:'A proposed client asks whether it already has audit rights because AskSocial’s training website describes sponsor audits. The agreement remains unsigned.',
    options:['Confirm that the Academy grants audit rights','Explain that rights need executed terms and route the draft agreement and schedules for authorized review','Sign on the sponsor’s behalf to speed onboarding'], answer:1,
    feedback:'Teaching a process does not execute an agreement. Authorized representatives must complete and approve the contract and schedules before the service is activated.',
    worksheet:['Identify the missing agreement schedules and decision owners.','Draft a factual response separating proposed terms from executed rights.','List the activation blockers and evidence needed to remove them.'],
    output:'Agreement readiness checklist, factual sponsor response and unresolved terms log.',
    critical:'Claiming unexecuted rights, making an unsupported service promise or signing without authority.',
    questions:[
      ['What creates contractual sponsor audit rights?',['A website description','An executed agreement containing the rights','A trainee’s acknowledgement'],1,'The template and learning content are preparatory documents.'],
      ['A transfer deadline schedule is blank. What should happen?',['Use a guessed standard deadline','Resolve and approve the timing schedule before activation','Ignore clocks until the sponsor complains'],1,'The source and agreement must determine the applicable timing, with no invented default.']
    ]
  },
  {
    id:17, title:'Sponsor audits and inspection support', doc:'ASPV INS 006', owner:'Quality inspection coordinator with PV and Engineering',
    objective:'Receive an evidence request, retrieve traceable records and disclose gaps accurately.',
    teaching:[
      'Verify the requester and contractual or regulatory basis, log the scope, period and deadline, assign a coordinator and preserve relevant records. An urgent regulatory inspection follows its applicable authority; routine sponsor notice provisions must not obstruct it. Use controlled access to protect unrelated sponsor information.',
      'Trace a case from original source and scope through the reviewer authorization valid at the time, original clock, decision, package version, dispatch, sponsor acknowledgement and reconciliation. Include current and superseded procedures, training, changes, validation, incidents and corrective actions as requested. Label exports, redactions, reconstructions and synthetic test evidence honestly.',
      'Review accuracy, relevance, privacy and provenance before release through the approved channel. Log what was released and receipt, preserve corrections and track follow-up questions. Record findings, root cause, actions and effectiveness evidence. A mock audit and timed retrieval exercise test readiness; neither a document pack nor a product audit log proves it alone.'
    ],
    scenario:'A verified sponsor asks for last quarter’s reviewer qualifications and a case’s complete transfer history. The file has provider acceptance but no sponsor acknowledgement.',
    options:['Create an acknowledgement now and backdate it','Supply only the sent status','Log the request, retrieve controlled evidence, disclose the missing receipt and investigate it'], answer:2,
    feedback:'Do not repair evidence by inventing history. Retain the gap, assign an investigation and supply a traceable accurate response under the approved process.',
    worksheet:['Build a request tracker with item owners and due times.','List the records needed and the qualification date you must verify.','Describe privacy review, release approval, gap handling and finding closure.'],
    output:'Audit request tracker, evidence index, release log and gap/CAPA record.',
    critical:'Backdating, fabricating evidence, hiding a missing receipt or disclosing another sponsor’s records.',
    questions:[
      ['Which qualification record supports a historical case?',['The qualification valid when the review occurred','Only the reviewer’s latest training badge','Any employee’s certificate'],0,'Historical authorization must be demonstrated at the time of the decision.'],
      ['When is a corrective action ready to close?',['When training is scheduled','When implementation and the defined effectiveness evidence are verified and approved','When a reply email is sent'],1,'Sending a response is not proof that the corrective action worked.']
    ]
  },
  {
    id:18, title:'Regulatory change and annual scope review', doc:'ASPV REG 007', owner:'PV Regulatory Lead with sponsor PV and Quality',
    objective:'Assess a guidance change and complete a separately documented annual service-scope review.',
    teaching:[
      'Maintain a regulatory source register with jurisdiction, version, publication, effective and transition dates, applicability, last check and next check. A consultation, final publication and effective requirement are different states. Check current official EMA, ICH regional and local sources and sponsor procedures rather than treating a future Module VI revision as already effective.',
      'A relevant change triggers an assessment of scope, source classification, rules, clocks, staffing, privacy, technology, agreements, validation and training. Sponsor PV decides sponsor applicability; each AskSocial owner approves their controlled changes. Set actions before the applicable deadline, including an approved temporary instruction when needed. Do not wait for the annual review.',
      'Review the complete sponsor service scope at least annually as the proposed internal control, even if no change is needed. Record products, languages, sources, exclusions, coverage, qualifications, deadlines, transfers and agreements reviewed; decisions; approvals; open actions; and the next due date. Staff refresher training does not substitute for this scope review. Close changes with implementation and effectiveness evidence.'
    ],
    scenario:'A fictional final authority revision changes handling of an in-scope digital activity and takes effect in three months. The next annual scope review is six months away.',
    options:['Wait for the annual review','Open a change assessment now, confirm applicability and plan approved implementation before the deadline','Immediately reclassify all historical reports without approval'], answer:1,
    feedback:'Change-triggered assessment and annual review are separate controls. Preserve historical rule versions and plan the approved transition, training and acceptance evidence.',
    worksheet:['Record source status, jurisdiction, version and dates.','Map impacts to procedures, scope, clocks, agreements, technology and training.','Create owners, milestones, interim controls and closure evidence; set the annual review separately.'],
    output:'Regulatory source entry, impact assessment, implementation plan and annual review record.',
    critical:'Missing an applicable deadline, assuming a draft is effective or silently rewriting historical rules.',
    questions:[
      ['Does annual staff reassessment satisfy annual scope review?',['Yes','No, service scope needs a separate documented review','Only if every trainee passes'],1,'The reviews have different purposes, owners and evidence.'],
      ['A source is a draft consultation. How should it be recorded?',['As already effective','With its actual status and an impact/planning decision','Ignore it permanently'],1,'Distinguish consultation, publication, transition and effective dates.']
    ]
  },
  {
    id:19, title:'Sponsor transfer procedures and integrations', doc:'ASPV XFER 008', owner:'PV, Engineering, QA and sponsor receiving team',
    objective:'Distinguish transfer states, investigate failed or uncertain receipt and identify acceptance evidence for an interface.',
    teaching:[
      'Define each interface’s intended use, approved destination, mapping and code-list versions, required fields, null handling, security, receiver and backup. Keep test and production destinations separate. An email/export feature does not establish a validated enterprise safety-system integration. Never put credentials or real safety records into this practice page.',
      'Preserve preparation, package approval, dispatch attempt, provider acceptance, sponsor technical receipt, business acknowledgement and reconciliation as distinct evidence. Link each to the exact case/package version. Original clocks survive retry and reassignment. A correction retains its predecessor and requires the appropriate receipt for the new package.',
      'On timeout or failure, preserve errors and investigate uncertain receipt before blind resends. Apply approved retry, duplicate control, alternate route and overdue escalation. Reconcile expected package IDs and versions with received, missing, rejected, duplicated and corrected records. Test successful and failed transfers, wrong versions, unauthorized access, outages, peak load and recovery. Sponsor receiving acceptance is needed; synthetic test results alone do not establish it.'
    ],
    scenario:'The provider accepted package v2, but the sponsor has not acknowledged it. The only receipt record names v1. The transfer dashboard shows sent.',
    options:['Close v2 using the v1 receipt','Preserve the clock and versions, open a discrepancy, verify v2 receipt and escalate using the approved route','Resend repeatedly until someone answers'], answer:1,
    feedback:'Provider acceptance is not sponsor acknowledgement, and an older package’s receipt cannot be silently inherited. Reconciliation needs version-specific evidence and accountable resolution.',
    worksheet:['Build a timeline separating dispatch, provider acceptance and sponsor receipt.','Identify discrepancy, investigation, retry/alternate-route and duplicate controls.','List mapping, access, recovery and receiver acceptance tests required before integration activation.'],
    output:'Failed-transfer discrepancy, package-specific receipt evidence and interface acceptance checklist.',
    critical:'Closing without appropriate receipt, resetting clocks, blind duplicate sending or activating an unvalidated destination.',
    questions:[
      ['What does provider acceptance prove?',['The sponsor completed intake','The provider accepted the dispatch, not necessarily sponsor receipt','Regulatory submission is complete'],1,'Retain provider acceptance separately from sponsor evidence.'],
      ['Which evidence accepts a safety-system integration?',['A successful file export','Approved intended-use tests and sponsor receiver acceptance with resolved critical failures','A draft mapping spreadsheet alone'],1,'Acceptance includes the actual intended workflow, exceptions, access and recovery.']
    ]
  }
];
