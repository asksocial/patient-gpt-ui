/*
 * AskSocial PV Academy — interactive exercise content, modules 1–4.
 * All mentions, people, handles and products are invented for training. "Drug A" is a placeholder.
 * Keys are teaching keys for practice; the client procedure governs live work.
 */
(function () {
  var X = window.pvExercises = window.pvExercises || {};
  // builders, shared by all exercise data files
  var B = window.pvxBuild = window.pvxBuild || {
    C: function (prompt, options, answer, why, extra) { return Object.assign({ type: 'choice', prompt: prompt, options: options, answer: answer, why: why }, extra || {}); },
    M: function (prompt, options, answers, why) { return { type: 'multi', prompt: prompt, options: options, answers: answers, why: why }; },
    T: function (prompt, text, cats, keys, why) { return { type: 'tag', prompt: prompt, text: text, cats: cats, keys: keys, why: why }; },
    O: function (prompt, steps, why) { return { type: 'order', prompt: prompt, steps: steps, why: why }; },
    R: function (prompt, model, checks) { return { type: 'rubric', prompt: prompt, model: model, checks: checks }; },
    I: function (label, stimulus, parts) { return { label: label, stimulus: stimulus, parts: Array.isArray(parts) ? parts : [parts] }; }
  };
  var C = B.C, M = B.M, T = B.T, O = B.O, R = B.R, I = B.I;

  // ------------------------------------------------------------------ Module 1
  var M1_TRACE = ['Fictional mention, captured Friday 18:50 from a planned listening dataset:', '“Started Drug A last week and my ankles have swollen up badly.”'];
  X[1] = {
    title: 'Trace one mention from receipt to reconciliation',
    intro: 'Follow one fictional mention through the workflow. Put the steps in order, decide who owns each action, including outside working hours, and explain why a suspected event does not need proof before internal routing.',
    items: [
      I('Workflow order', M1_TRACE, O('Put the workflow steps in the order they happen.', [
        'The mention is received into the screening queue',
        'A screener reviews it and identifies potential safety information',
        'The case is escalated and checked under the client procedure (QA where required)',
        'A traceable packet is transferred to client PV through the approved route',
        'Client PV acknowledges receipt',
        'AskSocial reconciles transfers against acknowledgements',
        'Client PV assesses the case and decides regulatory handling'
      ], 'Screening and transfer are AskSocial’s responsibilities within its agreement; the client’s assessment and regulatory decision sit at the end of the chain. Reconciliation confirms nothing was lost between sending and receipt.')),
      I('Who owns it?', M1_TRACE, C('Who decides whether the mention contains potential safety information?', ['The screener assigned to the queue', 'Client PV', 'The AI model score', 'The original poster'], 0, 'Identifying potential safety information is the screener’s job, using the approved rules. Client PV assesses it afterwards.')),
      I('Who owns it?', M1_TRACE, C('Who performs the second check of the packet before transfer, where the procedure requires one?', ['The same screener, rereading their own work', 'The AskSocial QA reviewer named in the procedure', 'Client PV', 'Nobody; QA is optional when the queue is busy'], 1, 'QA is a separate role with its own responsibility. It must not reset an earlier applicable clock.')),
      I('Out of hours', M1_TRACE, C('The mention arrives Saturday 23:30 and no routine screener is scheduled. What happens?', ['It waits for Monday’s routine queue regardless of content', 'The on-call route in the coverage schedule applies: automation flags it and the on-call responder handles potential urgency', 'The screener who is off duty is expected to check it from home', 'It is discarded because it arrived outside working hours'], 1, 'Out-of-hours handling follows the agreed coverage model (continuous automation with on-call escalation). Nobody improvises coverage, and nothing is discarded for arriving at the weekend.')),
      I('Who owns it?', M1_TRACE, C('Who decides whether this case must be reported to a regulatory authority?', ['The screener', 'AskSocial QA', 'Client PV, unless a written agreement explicitly delegates it', 'The team lead'], 2, 'Regulatory reporting decisions stay with the client unless a written agreement explicitly delegates them.')),
      I('Who owns it?', M1_TRACE, C('Who assesses whether Drug A caused the ankle swelling?', ['The screener, before deciding to escalate', 'Client PV medical review', 'The AI model', 'Nobody; causality must be proven before transfer'], 1, 'Causality assessment is separate medical training and sits with client PV. The screener escalates a suspected event without proving causality.')),
      I('Who owns it?', M1_TRACE, C('The packet was sent at Monday 10:00 but no acknowledgement has arrived by the agreed time. Who acts?', ['Nobody; sending is enough', 'The AskSocial transfer owner, who follows the failed-delivery escalation and confirms receipt', 'Client PV, who should notice it is missing', 'The original poster'], 1, 'A transfer is not complete until receipt is proven. The AskSocial owner escalates a missing acknowledgement through the agreed route.')),
      I('Terminology', null, C('“Any unfavorable medical occurrence in a person given a medicine, whether or not it is considered related to the medicine.” Which term is this?', ['Adverse event (AE)', 'Adverse drug reaction (ADR)', 'Individual case safety report (ICSR)', 'Marketing authorisation holder (MAH)'], 0, 'An AE does not require a causal link. That is why uncertainty about causality is not a reason to reject a mention.')),
      I('Terminology', null, C('“A response to a medicine where a causal relationship is at least a reasonable possibility.” Which term is this?', ['Adverse event (AE)', 'Adverse drug reaction (ADR)', 'Special situation', 'Product complaint'], 1, 'An ADR implies at least a reasonable possibility of a causal relationship. Making that judgment is client PV’s assessment, not the screener’s.')),
      I('Terminology', null, C('Which term describes the structured report of one case that client PV may submit to an authority?', ['Activity brief', 'Individual case safety report (ICSR)', 'Coverage schedule', 'Quality agreement'], 1, 'Screeners identify candidate information. Whether it becomes an ICSR, and its submission, are client PV steps.')),
      I('Terminology', null, C('Which organization holds the marketing authorisation for the medicine and carries the related safety obligations?', ['AskSocial', 'The platform hosting the post', 'The marketing authorisation holder (MAH), usually the sponsor', 'The pharmacist'], 2, 'The MAH, usually the contracting sponsor, keeps regulatory accountability even when it delegates screening work to AskSocial.')),
      I('Explain it', M1_TRACE, R('Explain to a new colleague why this mention should be routed internally even though nobody has proved that Drug A caused the swelling.',
        'Screening identifies suspected safety information; it does not establish causality. An adverse event is any unfavorable medical occurrence whether or not it is related to the medicine, so the post qualifies as a possible event after exposure. Waiting for proof would delay the client’s own assessment and could miss a clock. The screener records what the author said (product, ankle swelling, timing “last week”), flags any uncertainty, and routes the case under the procedure. Client PV then assesses causality and decides on reporting.',
        ['States that causality is not required to route a suspected event', 'Identifies product, event and timing from the source', 'Names client PV as responsible for causality and reporting decisions', 'Mentions the clock, or the risk of delay, if you wait for proof'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 2
  var SUBJ = ['The author', 'Another person the author describes', 'Unclear — cannot be determined from the text', 'Nobody — hypothetical, general or no experience'];
  var PE = ['product', 'event'];
  var TAGP = 'Tag the product words and the event or observation words. Tag only what is actually described as happening, not negated, hypothetical or pre-existing symptoms.';
  function mention(label, text, keys, subj, why) {
    return I(label, null, [T(TAGP, text, PE, keys, why), C('Who took the product or had the experience?', SUBJ, subj, null)]);
  }
  X[2] = {
    title: 'Annotate 20 patient-language mentions',
    intro: 'For each fictional mention, tag the exact product words and event or observation words, then say who the subject is. Keep what the author said separate from interpretation: do not turn everyday language into a diagnosis.',
    items: [
      mention('Uncertain connection', 'Not sure it is related but I’ve had blurry vision since starting Drug A.', { product: ['Drug A'], event: ['blurry vision'] }, 0, '“Not sure it is related” expresses uncertainty about causality; it is not a reason to skip the event. “Since starting” is timing information.'),
      mention('Slang and typos', 'my heart is racing every nite since the dose went up on drugA', { product: ['drugA'], event: ['heart is racing'] }, 0, 'Record “heart is racing” as written. It must not silently become tachycardia or another cardiac diagnosis. “Since the dose went up” is timing and dose information.'),
      mention('Sarcasm', 'Oh great, Drug A, the miracle pill that gave me a headache the size of Texas. Thanks.', { product: ['Drug A'], event: ['headache'] }, 0, 'Sarcasm does not cancel the experience described. The headache is reported; “size of Texas” is emphasis, not a severity measure.'),
      mention('Caregiver report', 'My son has been throwing up since his first dose of Drug A on Monday.', { product: ['Drug A'], event: ['throwing up'] }, 1, 'The patient is the son; the author is the reporter. Keep both roles distinct in the record.'),
      mention('Quoted text', '“Drug A made me dizzy” — that’s what my sister keeps telling everyone.', { product: ['Drug A'], event: ['dizzy'] }, 1, 'The “me” inside the quotation is the sister, not the author. Quoted text changes the subject.'),
      mention('Pre-existing symptom', 'I had terrible insomnia for years before I ever took Drug A, and it hasn’t changed.', { product: ['Drug A'], event: [] }, 0, 'The insomnia predates treatment and is unchanged, so no new event after exposure is described. Note it as medical history if your procedure asks for context; do not extract it as an event.'),
      mention('Negation and indication', 'Drug A works great for my psoriasis, no side effects at all!', { product: ['Drug A'], event: [] }, 0, 'Psoriasis is the indication, not an event, and “no side effects” is negated. Nothing qualifies as an event here.'),
      mention('Hypothetical question', 'Can Drug A cause hair loss?? asking for a friend', { product: ['Drug A'], event: [] }, 2, 'No exposure or experience is stated. “Asking for a friend” may or may not mean a real person, so the subject is unclear. Read the thread context before closing, and do not invent a patient.'),
      mention('Figurative language', 'Week 3 on Drug A and my legs feel like jelly lol', { product: ['Drug A'], event: ['legs feel like jelly'] }, 0, 'Record the patient’s own words. “Legs feel like jelly” could mean weakness or fatigue, but the screener does not choose the medical term.'),
      mention('Concomitant use', 'Took my Drug A with a glass of wine last night and woke up with the worst rash', { product: ['Drug A'], event: ['worst rash', 'rash'] }, 0, 'Wine is a concomitant exposure worth recording in the narrative, but the medicine is Drug A. Do not decide that the wine caused the rash.'),
      mention('Dechallenge and rechallenge', 'Stopped Drug A for a week and the stomach pain went away. Started again, pain is back.', { product: ['Drug A'], event: ['stomach pain', 'pain is back'] }, 0, 'Stopping and restarting with the pain going and returning are observations to record accurately. They are useful to client PV but are not proof of causality.'),
      mention('Misspelled product', 'Drgu A has me feeling so foggy at work, can’t concentrate', { product: ['Drgu A'], event: ['feeling so foggy', 'can’t concentrate'] }, 0, 'Misspellings of the product still count. Tag the words as written; the product alias list in your rulebook decides attribution.'),
      mention('Vague group claim', 'Everyone on the forum says Drug A causes weight gain.', { product: ['Drug A'], event: ['weight gain'] }, 2, 'A general claim about “everyone” does not identify a specific person who experienced the event. Record it and follow the agreed route for incomplete information.'),
      mention('Switching products', 'My dad’s doctor switched him from Drug B to Drug A and now his ankles are swollen', { product: ['Drug B', 'Drug A'], event: ['ankles are swollen'] }, 1, 'Both products are relevant: Drug A is the current medicine and Drug B the previous one. The patient is the father.'),
      mention('Hedged attribution', 'I’m not saying Drug A caused my nosebleeds but they started the same week.', { product: ['Drug A'], event: ['nosebleeds'] }, 0, 'The author hedges about causality but reports the event and a time relationship. Hedging is not a rejection rule.'),
      mention('Benefit plus event', 'Haven’t had a single migraine since Drug A. Only downside is I’m constantly thirsty.', { product: ['Drug A'], event: ['constantly thirsty'] }, 0, 'The migraines are the condition being treated and are negated. Being “constantly thirsty” is the event described.'),
      mention('No experience', 'Saw an ad for Drug A on the train. Looks like the worst name ever lol', { product: ['Drug A'], event: [] }, 3, 'An opinion about an advert involves no exposure and no experience. Record the rationale for no qualifying safety information.'),
      mention('Child exposure', 'my 6yo grabbed my Drug A pills, think she swallowed one?? she seems fine', { product: ['Drug A pills', 'Drug A'], event: ['swallowed one'] }, 1, 'A possible accidental pediatric exposure is a relevant observation even without harm. “Seems fine” does not close it; the special-situation route applies.'),
      mention('Medication error', 'Pharmacist gave me Drug D instead of Drug A by mistake, took it for 2 days', { product: ['Drug D', 'Drug A'], event: ['by mistake', 'took it for 2 days'] }, 0, 'A dispensing error with exposure is a relevant observation, even if no harm is described. Both products matter.'),
      mention('Unnamed product', 'Translated by the poster: “since the injection my arm is hot and red” (original in Spanish)', { product: ['injection'], event: ['arm is hot and red'] }, 0, 'No product is named, so do not assume it is Drug A. Record “injection” as stated, keep the original-language note, and check thread context for the product.')
    ]
  };

  // ------------------------------------------------------------------ Module 3
  var M3_TEXT = '“Since starting Drug A my mum has been confused and keeps falling over.”';
  var PROC = ['Client procedure for company-owned or sponsored channels', 'Planned external listening procedure (organized data collection, ODCS)', 'Incidental-discovery procedure', 'Market-research programme procedure', 'Patient-support programme procedure'];
  X[3] = {
    title: 'Same text, different source contexts',
    intro: 'The same words can need different handling depending on where they were found. Pick the procedure for each context, then complete the activity-worksheet questions. In live work, PV approves each source classification; the answers here follow a fictional activity brief.',
    reference: { title: 'Fictional activity brief (training only)', lines: [
      'Client: Northbay Therapeutics (fictional). Approved activities: (1) moderation of Northbay’s own social pages; (2) planned listening of public forums in the approved dataset (classified by Northbay PV as an ODCS); (3) a commissioned market-research survey; (4) a patient-support programme chat service.',
      'Anything found outside these activities follows the incidental-discovery procedure. Classification questions go to the Northbay PV lead; screeners do not decide them.'
    ] },
    items: [
      I('Client-owned page', [M3_TEXT, 'Posted as a comment on Northbay’s own Facebook page.'], C('Which procedure applies?', PROC, 0, 'A company-owned or sponsored channel is under the client’s responsibility, and its procedure (including day-zero rules) applies.')),
      I('Planned listening', [M3_TEXT, 'Found in the approved forum dataset during planned listening.'], C('Which procedure applies?', PROC, 1, 'Planned listening that PV has classified as an organized data collection system follows the ODCS procedure, including its identification-based clock.')),
      I('Incidental discovery', [M3_TEXT, 'Seen by a colleague browsing a forum outside the approved dataset while researching an unrelated project.'], C('Which procedure applies?', PROC, 2, 'The source is outside every approved activity, so the incidental-discovery procedure applies. The colleague still has to route it; it is not ignored.')),
      I('Market research', [M3_TEXT, 'Written in a free-text answer to the commissioned market-research survey.'], C('Which procedure applies?', PROC, 3, 'Safety information arising in commissioned market research follows that programme’s agreed procedure.')),
      I('Patient support', [M3_TEXT, 'Typed by a caregiver into the patient-support programme chat.'], C('Which procedure applies?', PROC, 4, 'Patient-support programmes have their own handling and follow-up arrangements, which differ from social listening.')),
      I('Who classifies?', null, C('A new source type appears that is not in the activity brief. Who decides how it is classified?', ['The screener, based on experience', 'The PV lead, as an approved programme decision', 'Whichever procedure gives the longest deadline', 'The platform’s terms of service'], 1, 'Source classification is a programme decision approved by PV. Screeners apply it; they do not create it.')),
      I('Dataset boundary', ['The text appears in the planned-listening export, but its posting date is two days before the dataset’s approved start date.'], C('What do you do?', ['Discard it because it is out of boundary', 'Record the boundary issue, preserve the item and route it via the agreed exception process', 'Change the dataset start date in the worksheet so it fits', 'Treat it as a client-owned page post'], 1, 'Scope or boundary uncertainty is never permission to discard safety information. Document it and use the exception route.')),
      I('Disagreement', ['You and a colleague disagree about whether a subreddit counts as planned listening or as an incidental discovery.'], C('What happens next?', ['Use the rule that makes the deadline easiest to meet', 'Assume all social-media channels follow one rule', 'Record the disagreement and the procedure version, and refer it to PV for a decision', 'Let the more senior colleague decide'], 2, 'Classification disagreements go to PV. Record what you did and which procedure version you used.')),
      I('Activity worksheet', null, M('Which fields belong on the activity worksheet for a mention?', ['Source category', 'Dataset boundary', 'Escalation route', 'Procedure version used', 'Author’s estimated age from the profile photo', 'Your opinion on causality'], [0, 1, 2, 3], 'The worksheet records context and rules, not inferences about the author or causality judgments.')),
      I('Compare the contexts', [M3_TEXT], R('In three or four sentences, explain what changes and what stays the same when this text appears on a client-owned page versus in a planned listening dataset.',
        'The words and the safety content stay the same: a possible event (confusion, falls) in a described patient (the author’s mother) after Drug A, which needs routing either way. What changes is the activity classification and therefore the procedure. On a client-owned page, the client’s channel rules apply and the clock can start when sufficient information is posted. In an ODCS dataset, the approved identification-based rule applies. The screener records the source category, boundary and procedure version, and refers any classification doubt to PV rather than assuming one rule fits all channels.',
        ['Says the safety content and the need to route are unchanged', 'Says the procedure and clock rule depend on the source classification', 'Names the client-owned-page and ODCS rules correctly', 'Mentions recording the procedure version or referring doubts to PV'])
      )
    ]
  };

  // ------------------------------------------------------------------ Module 4
  var ELEM = ['An identifiable patient (training rule)', 'An identifiable reporter (training rule)', 'A suspect or interacting medicine', 'An event or relevant observation'];
  var DISP = ['Potential case for client PV assessment', 'Incomplete safety concern', 'Special situation or quality concern', 'No qualifying safety information identified'];
  function ws(label, text, elems, disp, why) {
    return I(label, [text], [M('Which case elements can you locate in the source?', ELEM, elems, null), C('What is the disposition?', DISP, disp, why)]);
  }
  X[4] = {
    title: '15 case-element worksheets',
    intro: 'For each mention, mark the elements present under the training rule, then choose a disposition. Missing is not the same as unavailable, and the absence of an element does not automatically mean rejection.',
    reference: { title: 'Training rule for identifiability (fictional client rulebook)', lines: [
      'Patient: identifiable when the source indicates a specific person who had the experience (for example “I”, “my husband”, “a patient of mine”). A full legal name is not required. “People”, “everyone” or “my support group” do not identify a specific person.',
      'Reporter: identifiable when the author’s account is accessible for authorized follow-up through the approved channel. A deleted or inaccessible account makes the reporter unavailable.',
      'Relevant observations such as medication errors or pregnancy exposure can follow the agreed route even without a reported adverse outcome.'
    ] },
    items: [
      ws('First-person report', '“I’ve had a rash on my arms since starting Drug A.”', [0, 1, 2, 3], 0, 'All four elements are present under the training rule.'),
      ws('Caregiver', '“My husband gets nosebleeds on Drug A.”', [0, 1, 2, 3], 0, 'The husband is the patient and the author is the reporter. A name is not needed.'),
      ws('Vague group claim', '“Lots of people get headaches on Drug A.”', [1, 2, 3], 1, 'No specific patient is identified. Record it as an incomplete safety concern and follow the agreed route; do not reject it outright.'),
      ws('Deleted account', '“Drug A gave me awful cramps” — the account was deleted before follow-up.', [0, 2, 3], 1, 'The reporter is unavailable, which is different from never having been stated. Record that, keep the captured source, and route it as incomplete.'),
      ws('Product not named', '“This new pill makes me so dizzy.”', [0, 1, 3], 1, 'The product is missing. Check the thread context. If it remains unknown, record it as an incomplete concern rather than assuming a product.'),
      ws('No event', '“Started Drug A today, fingers crossed!”', [0, 1, 2], 3, 'No event or relevant observation is described. Record the rationale.'),
      ws('Near miss', '“The pharmacy almost gave me Drug A instead of my Drug B, but I caught it before taking it.”', [1, 2, 3], 2, 'An intercepted medication error is a relevant observation. Some regions treat it as reportable information without a patient exposure; it follows the agreed special-situation route.'),
      ws('Second-hand report', '“My friend’s cousin had a seizure on Drug A apparently.”', [0, 1, 2, 3], 0, 'A specific person is described, even second-hand, and “apparently” expresses uncertainty only. Route it, and flag the possible seriousness.'),
      ws('Pregnancy exposure', '“34 weeks pregnant and still on Drug A, all good so far.”', [0, 1, 2, 3], 2, 'Pregnancy exposure is a relevant observation even with no harm reported. Apply the pregnancy route; do not invent an outcome.'),
      ws('Support-group claim', '“My support group all say Drug A makes them tired.”', [1, 2, 3], 1, 'No specific patient is identified. Record it as an incomplete safety concern.'),
      ws('Two patients', '“Me and my twin both get migraines from Drug A.”', [0, 1, 2, 3], 0, 'There are two patients, each potentially a case. Record both as described.'),
      ws('Healthcare professional', '“Had a patient go into anaphylaxis 10 min after Drug A infusion today #nurselife”', [0, 1, 2, 3], 0, 'An HCP reporter describes a specific patient and a potentially serious event, so urgent handling applies. Do not record anything the post does not say.'),
      I('Unspecified event', ['“Drug A side effects are killing me.”'], [M('Which case elements can you locate in the source?', ELEM, [0, 1, 2, 3], null), C('What is the disposition?', DISP, [0, 1], '“Side effects” is unspecified, but it describes an experience after exposure. Either a potential case or an incomplete concern is accepted. The event detail is missing and needs authorized follow-up; it is not grounds for rejection.')]),
      ws('Accidental exposure', '“Took my mum’s Drug A by accident instead of my vitamins, feel fine.”', [0, 1, 2, 3], 2, 'Accidental exposure is a medication error, a relevant observation even without harm.'),
      I('Taste complaint', ['“Drug A tastes like metal.”'], [M('Which case elements can you locate in the source?', ELEM, [0, 1, 2, 3], null), C('What is the disposition?', DISP, [0, 2], 'A metallic taste may be an adverse event or a product-quality issue. Either route is accepted, and the client matrix decides whether both apply.')])
    ]
  };
})();
