import type { PersonaRecord } from "../personas/buildPersonaIntelligence";

export type SubjectTopic = { id: string; label: string; pattern: RegExp };
export type SearchSubject = { id: string; label: string; trigger: RegExp; topics: SubjectTopic[]; researchUse: string };
const topic = (id: string, label: string, pattern: RegExp): SubjectTopic => ({ id, label, pattern });
/** Discussion concepts, not diagnoses, verified experiences or causal assertions.
 * Native-language patterns improve retrieval without fabricating translated quotes. */
export const SEARCH_SUBJECTS: SearchSubject[] = [
  { id: "access", label: "access and affordability", trigger: /\b(costs?|prices?|pricing|afford\w*|insurance|coverage|access|availability|shortages?|copay|out.of.pocket)\b/i,
    topics: [
      topic("coverage", "insurance and coverage", /\b(insurance(?: companies)?.{0,80}(?:cover\w*|deni\w*|pay\w*|afford\w*|treatment|prescri\w*)|(?:health|drug|medical|treatment) insurance|insured|uninsured|coverage|copay\w*|prior authori\w*|reimbursement|medicare|medicaid)\b|保険|보험|seguro|cobertura/i),
      topic("prices", "prices and affordability", /\b(costs?|prices?|pricing|afford\w*|expensive|out.of.pocket|cash.pay|savings? programs?)\b|価格|費用|高額|가격|비용|비싸|\bpre[çc]os?\b|\bcustos?\b|\bprecios?\b/i),
      topic("availability", "availability and sourcing", /\b(shortages?|availability|supply|in stock|out of stock|access|sourcing|imports?)\b|品薄|品切れ|入手|공급|품절|직구|escassez|disponibilidad/i),
      topic("providers", "pharmacy and telehealth access", /\b(pharmacy|pharmacies|pharmacists?|telehealth|telemedicine|prescription denied)\b|薬局|処方|약국|처방|farm[aá]cia|farmacia/i),
    ], researchUse: "These discussions can inform research into affordability and access. They do not quantify household spending or establish reasons for treatment discontinuation." },
  { id: "safety", label: "safety and side effects", trigger: /\b(safety|side effects?|adverse|risks?|tolerability)\b/i,
    topics: [
      topic("digestive", "digestive symptoms", /\b(nausea|vomit\w*|constipat\w*|diarrh\w*|reflux|gastroparesis|stomach pain)\b|吐き気|便秘|嘔吐|메스꺼|구토|변비|diarreia|n[aá]usea/i),
      topic("energy", "fatigue and energy", /\b(fatigue|tired\w*|exhaust\w*|low energy)\b|倦怠|疲労|피로|cansa[çc]o/i),
      topic("body", "hair and body composition concerns", /\b(hair loss|muscle loss|lean mass|ozempic face)\b|脱毛|筋肉|탈모|근손실/i),
      topic("serious", "serious risk claims and safety questions", /\b(naion|vision loss|blindness|pancreatitis|cancer|suicid\w*)\b|失明|膵炎|실명|췌장염/i),
      topic("general_safety", "general side-effect and tolerability discussion", /\b(side effects?|adverse|safety|tolerability|complications?|adverse reactions?)\b|副作用|부작용|efeitos? colaterais|efectos secundarios/i),
    ], researchUse: "Reported concerns can inform research and medical-information priorities. Social discussion does not establish causality or adverse-event incidence." },
  { id: "appetite", label: "appetite and everyday eating", trigger: /\b(food noise|appetite|cravings?|eating|protein|exercise|daily life|quality of life)\b/i,
    topics: [
      topic("food_noise", "food noise and cravings", /food noise|cravings?|食べ物のこと|食への執着|음식 생각|음식에 대한 집착/i),
      topic("appetite", "appetite and fullness", /appetite|fullness|食欲|満腹|식욕|포만감|apetite|apetito/i),
      topic("nutrition", "nutrition and protein", /\b(protein|nutrition|dietary|eating)\b|タンパク|たんぱく|食事|단백질|식사|prote[ií]na/i),
      topic("daily_life", "exercise and everyday routines", /\b(exercise|daily life|quality of life|social eating|clothing)\b|運動|운동|exerc[ií]cio/i),
    ], researchUse: "Patient language can suggest concepts for qualitative interviews and patient-reported outcome development. It does not constitute a validated outcome measure." },
  { id: "maintenance", label: "continuation, stopping and maintenance", trigger: /\b(maintenance|plateaus?|taper\w*|wean\w*|persist\w*|discontinu\w*|stop(?:ping|ped)?|restart\w*|regain\w*|continuation|adherence)\b/i,
    topics: [
      topic("stopping", "stopping and treatment breaks", /\b(discontinu\w*|stopp(?:ed|ing) (?:taking |using )?(?:my |the )?(?:treatment|medication|glp.?1|semaglutide|tirzepatide|ozempic|wegovy|mounjaro|zepbound)|stop taking (?:my |the )?(?:treatment|medication|glp.?1|semaglutide|tirzepatide|ozempic|wegovy|mounjaro|zepbound)|treatment break|come off)\b|中止|断薬|(?:マンジャロ|ウゴービ|リベルサス).{0,15}(?:やめる|やめた|止める|止めた)|やめた|단약|중단|(?:약(?:을|은|도)?|마운자로(?:를|는|도)?|위고비(?:를|는|도)?)\s*(?:못\s*|안\s*)?끊|끊자마자|interromp\w*|parar de/i),
      topic("restart", "restarting treatment", /restart\w*|再開|(?:단약|중단|끊|요요).{0,60}다시.{0,8}(?:시작|맞|투여)|재시작|reinici\w*/i),
      topic("regain", "weight regain", /\b(weight regain|regain\w*)\b|リバウンド|요요|체중 재증가|recuper\w*.{0,15}peso/i),
      topic("maintenance", "maintenance and continued use", /\b(maintenance|persist\w*|adherence|continuation|long.term use)\b|体(?:重|型).{0,12}維持|維持.{0,12}(?:用量|投与)|(?:체중|몸무게|감량|체지방|용량).{0,25}유지|\d+\s*(?:kg|키로|정도)?\s*유지|유지\s*(?:용량|목표)|유지(?:용|자|차원|량|가능|가|할|하|해|중|나|는|를| 몇개월)|manuten[çc][ãa]o|mantenimiento|\bmaintain(?:ing)? (?:my |the )?(?:weight|weight loss)|keep(?:ing)? (?:the |my )?weight off|long.term (?:treatment|therapy|medication)/i),
      topic("plateau", "weight plateaus during continued treatment", /\bplateaus?\b|정체(?:기|되)|체중.{0,12}정체|体重.{0,12}停滞|停滞期|(?:[2-9]|\d{2,})\s*주(?:째|동안).{0,15}그대로/i),
      topic("tapering", "dose reduction and spacing", /\b(?:taper\w*|wean\w*).{0,30}(?:dose|off|treatment|medication|ozempic|wegovy|mounjaro|zepbound|glp.?1)|\b(?:dose|doses|shots?|injections?).{0,20}(?:taper\w*|spac\w*)|한\s*달에\s*한\s*번|(?:용량|mg).{0,25}(?:줄이|줄였|내렸)|減薬|投与間隔.{0,12}(?:延|広)/i),
    ], researchUse: "These accounts can generate hypotheses about continuation and maintenance. A cross-sectional discussion corpus cannot estimate persistence rates or individual treatment trajectories." },
  { id: "dosing", label: "dosing and administration", trigger: /\b(dos(?:e|es|ing)|microdos\w*|titration|exposure|splitting|stretching)\b/i,
    topics: [
      topic("microdosing", "microdosing and dose alteration", /microdos\w*|split\w*.{0,12}dose|stretch\w*.{0,12}dose|sharing.{0,10}pen|counting clicks|微量投与|分割投与/i),
      topic("adjustment", "dose adjustment and titration", /\b(dos(?:e|es|ing)|titration|escalation)\b|用量|増量|減量|용량|증량|감량/i),
      topic("administration", "administration and treatment routines", /\b(injection|weekly|tablet|needle|administration)\b|注射|주사/i),
    ], researchUse: "Dose-related mentions do not establish actual exposure or off-label use. Low doses may be prescribed; research conclusions require contextual review." },
  { id: "women", label: "women’s health and life stage", trigger: /\b(pcos|pregnan\w*|contracept\w*|birth control|postpartum|breastfeed\w*|lactation|perimenopaus\w*|menopaus\w*|fertility|women.s health)\b/i,
    topics: [
      topic("pcos", "PCOS", /\bpcos\b|多嚢胞|다낭성/i),
      topic("contraception", "contraception questions", /contracept\w*|birth control|避妊|피임|anticoncep\w*/i),
      topic("pregnancy", "pregnancy and postpartum questions", /pregnan\w*|postpartum|妊娠|産後|임신|산후|gravidez|embaraz\w*/i),
      topic("lactation", "breastfeeding and lactation questions", /breastfeed\w*|lactation|授乳|수유|amamenta\w*|lactancia/i),
      topic("menopause", "menopause and hormonal changes", /perimenopaus\w*|menopaus\w*|hormone therapy|更年期|폐경/i),
    ], researchUse: "These discussions identify life-stage questions for further research and appropriate medical review. They do not establish subgroup effectiveness, comparative risk or treatment recommendations." },
  { id: "household", label: "household economics and time costs", trigger: /\b(household|productivity|indirect costs?|time costs?|missed work|lost wages|caregiver (?:time|strain)|administrative burden)\b/i,
    topics: [
      topic("work", "work and productivity costs", /missed work|lost wages|time off work|productivity|仕事を休|결근/i),
      topic("time", "administrative time and care burden", /hours.{0,50}(pharmacy|insurance|authoriz)|caregiver (time|strain)|administrative burden/i),
      topic("allocation", "household affordability and allocation", /household.{0,40}(cost|budget|afford)|family.{0,50}(afford|budget)|家計|가계|renda familiar/i),
    ], researchUse: "Any examples are exploratory. Quantifying indirect costs requires explicit time, spending or productivity observations and an appropriate study design." },
  { id: "education", label: "education and confusion", trigger: /\b(education|educational|confusion|confused|misinformation|awareness|knowledge gaps?)\b/i,
    topics: [topic("education", "information needs and uncertainty", /education|confus\w*|misinformation|awareness|understand|information|questions?|learn|explained/i)], researchUse: "Questions and claims can inform research priorities; the presence of a claim does not establish its accuracy." },
  { id: "outcomes", label: "treatment benefits and outcomes", trigger: /\b(benefits?|outcomes?|effectiveness|effective|improvement|improved)\b/i,
    topics: [topic("outcomes", "reported benefits and outcomes", /benefit|outcome|effective|improved|helped|worked|recovered|weight loss|減量|체중 감량|perda de peso/i)], researchUse: "Discussion of benefit is not a comparative-effectiveness estimate or a validated clinical outcome." },
  { id: "research", label: "research and evidence", trigger: /\b(research|studies|study|trials?|scientific|clinical evidence)\b/i,
    topics: [topic("research", "research and clinical evidence discussion", /research|stud(?:y|ies)|trial|scientific|clinical evidence|efficacy/i)], researchUse: "Research references require review of the original study before use in an evidence dossier." },
  { id: "policy", label: "policy and regulation", trigger: /\b(policy|regulat\w*|approval|approved|fda|ema)\b/i,
    topics: [topic("policy", "policy and regulatory discussion", /policy|regulat\w*|approval|approved|\bfda\b|\bema\b|legislation/i)], researchUse: "Discussion is not verification of current policy or approved labeling." },
  { id: "commercial", label: "market and commercial discussion", trigger: /\b(investment|investors?|commercial|sales|revenue|demand)\b/i,
    topics: [topic("commercial", "commercial and financial discussion", /market|invest\w*|commercial|sales|revenue|demand|earnings|launch|stock/i)], researchUse: "Commercial discussion does not establish patient adoption or treatment utilization." },
];

export function searchRecordText(record: PersonaRecord & { title?: string; canonicalClaim?: string }): string {
  const fields = record.rawMetadata?.fields || {};
  const source = [fields.Title, fields["Opening Text"], fields["Hit Sentence"]].filter(Boolean).join(" ");
  return (source || [record.title, record.summary, record.canonicalClaim].filter(Boolean).join(" "))
    .normalize("NFKC")
    .replace(/💙 제목에[\s\S]*?(?:---|부작용으로 트림이 너무 심해요|직접 찍은 사진\(권장\) 또는 체중 기록 사진 등을 넣어주세요!)/g, " ");
}

export function subjectsForQuestion(question: string): SearchSubject[] {
  return SEARCH_SUBJECTS.filter(subject => subject.trigger.test(question));
}

/** Narrow an explicitly named subtopic, while umbrella questions use all its topics. */
export function topicsForQuestion(subject: SearchSubject, question: string): SubjectTopic[] {
  if (subject.id === "access" && /insurance|coverage|copay|prior authori/i.test(question) && !/cost|price|afford|access|availability|shortage|pharmac|telehealth/i.test(question)) return subject.topics.filter(t => t.id === "coverage");
  if (subject.id === "women" && !/women.s health|life stage|life course/i.test(question)) {
    const selected = subject.topics.filter(t => t.pattern.test(question));
    if (selected.length) return selected;
  }
  if (subject.id === "maintenance" && /restart/i.test(question) && !/stop|regain|maintenance/i.test(question)) return subject.topics.filter(t => t.id === "restart");
  if (subject.id === "maintenance" && /\b(stop(?:ping|ped)?|discontinu\w*)\b/i.test(question) && !/restart|regain|maintenance|persist|adheren|continuation/i.test(question)) return subject.topics.filter(t => t.id === "stopping");
  if (subject.id === "appetite" && /food noise/i.test(question)) return subject.topics.filter(t => t.id === "food_noise");
  if (subject.id === "maintenance" && /regain/i.test(question) && !/stopp|maintenance|restart/i.test(question)) return subject.topics.filter(t => t.id === "regain");
  if (subject.id === "women" && /\bpcos\b/i.test(question) && !/pregnan|contracept|menopaus|postpartum|women.s health/i.test(question)) return subject.topics.filter(t => t.id === "pcos");
  if (subject.id === "dosing" && /microdos/i.test(question) && !/titration|exposure/i.test(question)) return subject.topics.filter(t => t.id === "microdosing");
  return subject.topics;
}
