import type { CanonicalFinding } from '../../answering/models/finding';

export const CONTEXT_RULES_VERSION = 'source_context_v2';

/** Match original content, never platform names, URLs or derived taxonomy labels. */
export function cleanSourceText(value: unknown): string {
  return String(value || '').normalize('NFKC').replace(/[’‘]/g, "'")
    .replace(/💙 제목에[\s\S]*?(?:---|부작용으로 트림이 너무 심해요|직접 찍은 사진\(권장\) 또는 체중 기록 사진 등을 넣어주세요!)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function sourceContext(finding: CanonicalFinding): string {
  const raw = finding as CanonicalFinding & { title?: string; description?: string; text?: string; excerpt?: string };
  const fields = finding.rawMetadata?.fields || {};
  const normalized = finding.rawMetadata?.normalizedFields || {};
  const comment = /comment/i.test(String(fields['Content Type'] || '')) || /^comment on\b/i.test(String(fields['Author Name'] || ''));
  const source = [
    ...(!comment ? [fields.Title, normalized.headline, normalized.title] : []),
    fields['Opening Text'], fields['Hit Sentence'], normalized.opening_text, normalized.hit_sentence,
    normalized.full_text, normalized.fulltext,
  ].filter(value => typeof value === 'string' && value.trim());
  // A title inherited by a comment is source context, not the commenter's signal.
  if (source.length) return [...new Set(source.map(cleanSourceText))].join(' ');
  const original = [raw.title, raw.text, raw.excerpt, raw.description,
    ...(finding.evidence || []).map(e => e.excerpt),
  ].map(cleanSourceText).filter(Boolean);
  return [...new Set(original.length ? original : [cleanSourceText(finding.summary)])].join(' ');
}

const native = {
  research: /\b(?:scientific|researchers?|efficacy|mechanisms?|effectiveness)\b|연구|임상|논문|효능|효과|기전|研究|臨床|試験|机制|機制|estud[oi]|pesquisa|investigaci[oó]n|ensaios?|essai|Forschung|Studie/iu,
  questions: /궁금|질문|문의|괜찮.{0,5}(?:나요|을까)|될까요|되나요|알려|어떻게|어디서|質問|疑問|教えて|どうすれば|请问|請問|pergunt|d[uú]vida|pregunt|duda|Frage/iu,
  safety: /\b(?:nausea|vomit\w*|constipat\w*|diarrh\w*|fatigue|side.effects?|tolerability)\b|부작용|위험|안전|메스꺼|구토|변비|설사|통증|입원|副作用|安全|危険|吐き気|嘔吐|便秘|不良反应|不良反應|efeitos? colaterais|efectos? secundarios|seguran[çc]a|Nebenwirkung|Sicherheit/iu,
  outcomes: /\b(?:lost.{0,10}weight|weight.loss|blood.sugar|a1c|effective(?:ness)?)\b|효과|효능|감량|체중|살.{0,4}빠|体重|減量|効果|疗效|療效|emagrec|perd[ai].{0,12}peso|efic[aá]cia|eficacia|wirksam|Gewichtsverlust/iu,
  access: /\b(?:copay\w*|out.of.pocket|prior.authori\w*|reimbursement|denied.coverage|shortages?)\b|가격|비용|보험|처방|구매|품절|부족|약국|비싸|多少钱|价格|價格|保険|費用|処方|価格|入手|보험|가격|custo|pre[çc]o|precios?|cobertura|seguro|acceso|Zugang|Kosten|Versicherung/iu,
  comparison: /\b(?:vs|versus|switch\w*|compar\w*|instead.of)\b|비교|갈아타|바꿨|바꾸|대신|보다.{0,8}(?:낫|좋|효과)|차이|比較|切り替|乗り換|比べ|对比|對比|compar|troca|mudar|cambiar|Wechsel|Vergleich/iu,
  dosing: /\b\d+(?:\.\d+)?\s*mg\b|용량|증량|감량.{0,8}(?:mg|밀리)|주사|투여|用量|増量|減量|注射|投与|剂量|劑量|injet|inyecci[oó]n|dosagem|Spritz|Dosierung/iu,
  trial: /임상\s*(?:시험|연구)|시험\s*참여|연구\s*참여|무작위|위약|臨床(?:試験|研究)|治験|临床(?:试验|研究)|臨床試驗|ensaios? cl[ií]nicos?|ensayos? cl[ií]nicos?|essais? cliniques?|klinische.{0,8}Studie/iu,
  recruitment: /모집|등록|참여자|지원자|招募|募集|被験者|被试|入组|recrut|inscri[çc]|reclut|enrol|rekrut/iu,
  eligibility: /선정\s*기준|제외\s*기준|참여\s*자격|適格|選択基準|除外基準|入选标准|入選標準|elegib|inclus[aã]o|exclus[aã]o/iu,
  retention: /중도\s*탈락|참여\s*중단|추적\s*관찰|追跡|脱落|退出试验|退出試驗|seguimento|abandono|Nachbeobachtung/iu,
  site: /연구자|연구\s*진|시험\s*기관|시험\s*센터|治験施設|治験担当|研究团队|研究團隊|investigador|centro de pesquisa|Prüfzentrum/iu,
  community: /환자|보호자|가족|커뮤니티|동료|患者|家族|家属|家屬|pacient|cuidador|comunidade|comunidad|Angehörig/iu,
  advocacy: /환자\s*단체|환우회|지원\s*단체|患者会|患者団体|患者组织|患者組織|associa[çc][aã]o|asociaci[oó]n|Patientenorganisation/iu,
  policy: /정책|규제|정부|승인|법안|식약처|規制|承認|政策|政府|批准|regula[çc]|regulaci[oó]n|pol[ií]tica|aprova[çc]|aprobaci[oó]n|Zulassung/iu,
  trust: /신뢰|불신|논란|비판|가짜|사기|信頼|不信|批判|偽物|信任|骗局|騙局|confian[çz]a|credibil|Vertrauen/iu,
  information: /정보|교육|설명|이해|혼란|모르겠|情報|説明|教育|わから|资讯|資訊|informaci[oó]n|informa[çc][aã]o|educa[çc]|Aufklärung/iu,
  fear: /불안|걱정|무섭|두렵|不安|怖|心配|焦虑|焦慮|medo|miedo|ansiedad|Angst/iu,
  regret: /후회|실망|後悔|失望|decep[çc]|arrepent|decepcion|bereu/iu,
  hope: /기대|기쁘|행복|만족|嬉し|満足|希望|esperan[çz]a|feliz|zufrieden/iu,
  recovery: /회복|멍|붓기|부기|回復|腫れ|肿胀|腫脹|recupera[çc]|hinchaz[oó]n|Schwellung/iu,
  provider: /\b(?:clinicians?|pharmacists?|hcp)\b|의사|병원|의원|전문의|상담|医師|病院|医生|醫生|m[eé]dic[oa]|cl[ií]nica|Arzt|Ärzt/iu,
  treatment: /\bi(?: am|\x27m| have|\x27ve)? (?:taking|take|started|using|use|tried|injected|am on)\b|맞았|맞고|복용|투여|服用|打った|使用中|注射|tomando|uso |tomei|nehme|spritze/iu,
  consideration: /고민|맞을까|맞아볼까|시작.{0,8}(?:할까|해도)|検討|考えて|試したい|考虑|考慮|pensando|considerando/iu,
};
type Concept = keyof typeof native;
const map: Record<string, Concept[]> = {
  scientific_perception: ['research'], evidence_gaps: ['questions','information'], medical_questions: ['questions'], safety_discussion: ['safety'],
  awareness_trust: ['trial','trust'], recruitment: ['recruitment'], eligibility: ['eligibility'], protocol: ['dosing'], retention: ['retention'], site_experience: ['site'], participant_experience: ['fear','community'], outcomes_endpoints: ['outcomes','research'], safety_tolerability: ['safety'],
  reputation: ['trust'], stakeholders: ['community','provider'], advocacy: ['advocacy'], narratives: ['trust'],
  brand_perception: ['outcomes'], adoption: ['access','safety','consideration'], message_response: ['information'], opportunity: ['questions','access'],
  landscape: ['comparison'], positioning: ['comparison'], switching: ['comparison'], white_space: ['questions','access'],
  community_priorities: ['community','questions','fear'], organizations: ['advocacy'], access_equity: ['access'], policy_awareness: ['policy','information'],
  awareness: ['information'], consideration: ['consideration'], provider_selection: ['provider'], treatment: ['treatment'], recovery: ['recovery'],
  trust_safety: ['safety','trust'], expectations: ['outcomes'], reversibility: [], cost_access: ['access'], provider_choice: ['provider'], recovery_burden: ['recovery','safety'],
  fear: ['fear'], confusion: ['questions','information'], regret: ['regret'], hope: ['hope'], skepticism: ['trust'],
  plain_language_safety: ['safety'], expectation_setting: ['outcomes'], provider_guidance: ['provider'], recovery_support: ['recovery','safety'], comparison_support: ['comparison'],
};
const cache = new Map<string, RegExp>();
function englishPattern(pattern: RegExp): RegExp {
  let result = cache.get(pattern.source);
  if (result) return result;
  let source = pattern.source;
  const stems = ['credib','responsib','controvers','critici','enroll','enrol','recruit','convenien','discontinu','tolerab','compet','dissatisf','regulat','inequit','dispar','represent','improv','confus','skeptic','randomi','hospitali'];
  for (const stem of stems) source = source.replace(new RegExp(`\\b${stem}\\b`, 'g'), `${stem}[a-z]*`);
  source = source.replace(/\bstudy\b/g, 'stud(?:y|ies)').replace(/\bsafe\b/g,'(?:safe|safety|unsafe)');
  result = new RegExp(`(?<![a-z])(?:${source})(?:s|es|ed|ing)?(?![a-z])`, 'i');
  cache.set(pattern.source,result);return result;
}
export function matchesContextSignal(id: string, pattern: RegExp, text: string): boolean {
  return englishPattern(pattern).test(text) || (map[id] || []).some(concept => native[concept].test(text));
}
export function hasTrialContext(text: string): boolean {
  return /\b(?:trials?|stud(?:y|ies)|enrol\w*|recruit\w*|investigator|protocol|randomi[sz]\w*|placebo|clinicaltrials\.gov)\b/i.test(text) || native.trial.test(text);
}
export function expressesInformationNeed(text: string): boolean {
  return /\?|\b(?:need|wish|help|how|where|why|unclear|unsure|looking for|want to know|lack|can't|cannot)\b/i.test(text) || native.questions.test(text) || /필요|부족|알고\s*싶|知りたい|教えて|需要|preciso|necesito/iu.test(text);
}
