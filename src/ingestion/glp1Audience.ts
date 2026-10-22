/** Corpus-specific audience rules. Source text is data; no instructions are executed.
 * Patient labels describe supported content, not verified author identities.
 */
export const GLP1_AUDIENCE_VERSION = "glp1-audience-2026-10-22.1";
export type Glp1Audience = "patient" | "caregiver" | "provider_hcp" | "company_or_commercial" | "media_or_research" | "community_observer" | "patient_community" | "general_discussion" | "off_topic" | "insufficient_context";
export type Glp1AudienceClassification = {
  version: string;
  audience: Glp1Audience;
  designation: string;
  patientContent: boolean;
  eligiblePatientVoice: boolean;
  confidence: number;
  signals: string[];
  matchedEvidence: string[];
  reviewRequired: boolean;
  topicRelevant: boolean;
};
type Source = Record<string, unknown>;
const TOPIC = /glp[\s-]?1|glucagon.like peptide|semaglutid|tirzepatid|retatrutid|liraglutid|dulaglutid|exenatid|lixisenatid|ozempic|wegovy|rybelsus|m[oa]unjaro|manjaro|zepbound|saxenda|victoza|trulicity|byetta|bydureon|adlyxin|마운자로|만자로|위고비|오젬픽|삭센다|マンジャロ|オゼンピック|ウゴービ|リベルサス|司美格鲁肽|司美格魯肽|替尔泊肽|替爾泊肽|利拉鲁肽|利拉魯肽|مونجارو|أوزمبيك|اوزمبيك|ويجوفي/iu;
const COMMERCIAL = /buy now|shop now|dm to order|promo code|discount code|use my code|affiliate|book now|contact us|free consultation|without (?:a )?prescription|no prescription|acquisto online|comprare online|comprar (?:ozempic|semaglutida)|купить|주문\s*문의|할인\s*코드|예약\s*문의|구매\s*링크|购买链接|購買連結|お気軽にご連絡|処方可能|\bsponsors?\b|\$\d+ off|\bcode\s*:\s*\w+|\bcode assata\b|mochipartner|glp-1 smart method|glp-1 coach|express med spas|join the glp-1 forum|at the glp-1 forum|at the glp1 forum|at the glp-1 forum|board-certified derms/iu;
const SPAM = /canadian pharmacy|where to buy arcalion|pharmacy sectors|cialis|viagra|kamagra|levitra|securities class action|shareholder alert/iu;
const PROVIDER = /\b(?:my|our) patients?\b|\b(?:in|at) (?:my|our) (?:practice|clinic)\b|\bi (?:prescribe|prescribed|treat|treated|administer)\b|\bwe (?:prescribe|treat|offer)\b|저희\s*(?:병원|의원)|우리\s*병원|私の患者|当院|mis pacientes|meus pacientes|mes patients|meine patienten/iu;
const CAREGIVER = /\bmy (?:wife|husband|partner|spouse|mother|father|mom|dad|son|daughter|child)\b.{0,65}\b(?:tak\w*|start\w*|us\w*|on|tried|inject\w*|dose|nausea)|(?:엄마|아빠|어머니|아버지|남편|아내).{0,25}(?:맞고|맞은|시작|처방)|(?:mi (?:madre|padre|esposa|marido)|minha mãe|meu pai).{0,50}(?:toma|usa|tomando|empez)/iu;
// Each rule combines a personal action/outcome with GLP-1 context at the caller.
const EXPERIENCE: Array<[string, RegExp]> = [
  ["en_personal_treatment", /\bi(?:['’]m| am|['’]ve| have)?\s+(?:(?:been|just|recently|also|still|now)\s+)*(?:tak(?:e|ing|en)|took|start(?:ed|ing)|us(?:e|ed|ing)|inject(?:ed|ing)?|tried|try|stopp(?:ed|ing)|switch(?:ed|ing)|lost|losing|regain(?:ed|ing)|am on|went on)\b|\bi['’]m on\b|\bi (?:was|have been) on\b|\bmy (?:dose|injection|shot|a1c|blood sugar|weight|appetite|insurance|prescription|side effects?)\b|\b(?:worked for me|helped me|made me (?:sick|nauseous))\b/iu],
  ["ko_personal_treatment", /(?:처음|첫)\s*(?:주사|맞아|펜)|(?:맞은\s*지|맞았|맞앗|맞아봤|맞고\s*있는데|맞고\s*나서|맞기 시작|처방\s*받았|처방받아서|받아왔|받고 왔)|(?:^|\s)(?:내가|저는|제가|나는|난|내)\s.{0,30}(?:부작용|체중|몸무게|감량)|\d+\s*(?:주차|일차).{0,30}(?:후기|감량|키로|키러|체중|몸무게|울렁|빠짐|복구)|(?:단약|증량)\s*\d+|(?:\d+(?:\.\d+)?\s*(?:mg|펜)).{0,20}(?:구매완료|후기)|(?:단약중|단약 중|맞다가.{0,20}단약|맞으면서 느낀|모범 마운자로 사용자|나한테 너무 약한가)/u],
  ["ja_personal_treatment", /(?:私|わたし|僕|俺|ワイ).{0,45}(?:使|打|飲|痩|やせ|体重|副作用|患者)|(?:マンジャロ|ウゴービ|リベルサス).{0,25}(?:始めました|始めた|打った|打ってる|打っています|服用中|使用中)|(?:投与|服用|注射|使用)\s*\d+\s*(?:日目|週目|ヶ月目)/u],
  ["pt_personal_treatment", /\b(?:eu (?:tomo|tomei|comecei|uso|usei|perdi|estou tomando)|estou (?:tomando|usando)|minha (?:dose|glicemia|fome)|meu (?:peso|tratamento)|tomei|comecei a (?:tomar|usar)|emagreci)\b/iu],
  ["es_personal_treatment", /\b(?:yo (?:tomo|tomé|uso|usé|empecé|perdí)|estoy (?:tomando|usando)|mi (?:dosis|peso|tratamiento|glucosa)|he (?:perdido|empezado)|empecé a (?:tomar|usar))\b/iu],
  ["fr_personal_treatment", /\b(?:je (?:prends|prenais|suis sous)|j['’]ai (?:commencé|perdu|pris)|mon (?:poids|traitement)|ma dose)\b/iu],
  ["de_personal_treatment", /\b(?:ich (?:nehme|habe.{0,20}abgenommen|spritze|bin seit)|meine (?:dosis|nebenwirkungen)|mein (?:gewicht|blutzucker))\b/iu],
  ["zh_personal_treatment", /我.{0,25}(?:打了|打完|用了|用药|用藥|服用|开始用|開始用|瘦了|减了|減了)|(?:注射|用药|用藥)第\s*\d+\s*(?:天|周|週)/u],
  ["en_patient_journey", /\bmy (?:glp[ -]?1|ozempic|wegovy|mounjaro|zepbound|weight\s?loss) (?:journey|experience)|\bsince (?:i )?start(?:ed|ing) (?:mounjaro|ozempic|wegovy|zepbound)|\bi (?:am|was|have been|['’]ve been) on (?:it|mounjaro|ozempic|wegovy|zepbound|a glp)|\bi (?:was using|began|got gastroparesis)|\bpatient here\b|\bi['’]ve been trying\b|\b(?:my personal experience|my experience with|because of tirzepatide i|has worked for me)\b/iu],
  ["ko_patient_journey", /(?:마운자로|만자로|위고비).{0,18}(?:\d+\s*(?:주차|일차|달째|개월)|한지\s*\d+|효과 없는 건가요|맞고.{0,15}(?:없는데|떨어|심하게|바뀌었|근육통)|처방\s*받아서)|(?:^|\s)\d+(?:\.\d+)?\s*(?:mg|미리|주차).{0,20}(?:증량|근육통|부작용)|(?:첫날|첫방|첫 부작용).{0,20}(?:역류|맞고|울렁|ㅅㅂ)/u],
];
const PROSPECTIVE: Array<[string, RegExp]> = [
  ["en_patient_question", /\b(?:should i|can i|i (?:want|plan|hope|need) to (?:try|start|take|use)|i(?:['’]m| am) (?:considering|thinking)|has anyone (?:tried|taken|used)|anyone else (?:on|taking|getting)|can['’]t afford|cannot afford|insurance denied me)\b/iu],
  ["ko_patient_question", /(?:맞아볼까|맞을까|맞아야|해야겠|고민됨|고민중|고민 중|맞으면.{0,20}(?:생겨|심함|괜찮)|맞아봤거나|주사할때|처방\s*받으신|처방\s*받으려|처방\s*받으러|처방\s*받고싶|알아보러|맞고 어떤 부작용|증량하려는데|해볼게|마운자로.{0,15}(?:정상인가요|궁금해요|괜찮을까요|될까요|되나요|문의)|마운자로.{0,12}안 맞는 이유|마운자로.{0,12}처음 사는데)/u],
  ["multilingual_patient_question", /(?:devo|posso|quero|puedo|quiero|debería)\s+(?:tomar|usar|empezar|começar)|(?:使おうか|打とうか|始めようか|試したい)|我想.{0,15}(?:用|打|试|試)/iu],
];
const REPORTED = /\b(?:patient|woman|man|she|he|they)\b.{0,60}\b(?:lost|taking|took|started|side effects|experience)|환자.{0,25}(?:경험|부작용)|女性.{0,25}(?:使用|体重|使)|患者.{0,25}(?:经历|經歷|体重|體重)/iu;
const CLINICAL = /\b(?:study|trial|research|fda|ema|efficacy|randomized|phase [123])\b|임상|연구|臨床|研究|ensaio clínico|ensayo clínico/iu;

export function classifyGlp1Audience(row: Source): Glp1AudienceClassification {
  const normalize = (x: unknown) => {
    const raw = String(x || "");
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
    return value.normalize("NFKC").replace(/[’‘]/g, "'").trim();
  };
  const isComment = /comment/i.test(String(row["Content Type"] || "")) || /^comment on\b/i.test(String(row["Author Name"] || ""));
  // Meltwater comments inherit the parent post's title/channel metadata. That
  // metadata supplies topic context, but cannot establish the commenter's role.
  const fields = [...new Set((isComment ? [row["Opening Text"], row["Hit Sentence"]] : [row.Title, row["Opening Text"], row["Hit Sentence"]]).map(normalize).filter(Boolean))];
  const text = fields.join(" \n ");
  const source = String(row["Source Type"] || "").toLowerCase();
  const url = String(row.URL || "");
  const author = isComment ? "" : `${row["Author Name"] || ""} ${row["Author Handle"] || ""}`;
  const personalSource = /forum|social|review|comment|blog/.test(source);
  const topicRelevant = TOPIC.test(text) || isComment && TOPIC.test(normalize(row.Title));
  const make = (audience: Glp1Audience, designation: string, confidence: number, signals: string[], matchedEvidence: string[] = [], patientContent = false, eligiblePatientVoice = false): Glp1AudienceClassification => ({
    version: GLP1_AUDIENCE_VERSION, audience, designation, confidence, signals, matchedEvidence, patientContent, eligiblePatientVoice,
    reviewRequired: eligiblePatientVoice || confidence < 0.7, topicRelevant: audience !== "off_topic" && topicRelevant,
  });
  if (/جيلي|geely|monjaro.*car|蒙扎罗.*汽车/iu.test(text)) return make("off_topic", "automotive_name_collision", 0.95, ["Geely Monjaro vehicle context, not a GLP-1 medication"]);
  if (SPAM.test(text)) return make("company_or_commercial", "spam_or_search_manipulation", 0.85, ["Spam or unrelated pharmacy solicitation"], [text.match(SPAM)![0]]);
  if (COMMERCIAL.test(text) || /prnewswire|businesswire|globenewswire/i.test(url)) {
    const testimony = topicRelevant ? EXPERIENCE.flatMap(([id, rule]) => { const match = text.match(rule); return match ? [{ id, text: match[0] }] : []; }) : [];
    return make("company_or_commercial", testimony.length ? "commercial_patient_testimonial" : "commercial_or_promotional",
      testimony.length ? 0.65 : 0.85, ["Solicitation, affiliate, or corporate press source", ...(testimony.length ? ["Contains possible personal patient speech; commercial influence remains explicit"] : [])], testimony.map(x => x.text), testimony.length > 0);
  }
  if (!topicRelevant) return make("off_topic", "no_supported_glp1_context", 0.6, ["No supported GLP-1 term in available content; export membership alone is insufficient"]);
  // QT exports separate the quoted post and the current author's commentary by
  // a semicolon. Only the latter can establish the current author's experience.
  const hasQuote = fields.some(field => /^\s*(?:RT\s+@|QT\s+@)/i.test(field));
  const ownText = hasQuote ? fields.filter(field => /;/.test(field)).map(field => field.slice(field.indexOf(";") + 1)).join(" \n ") : text;
  const experience = EXPERIENCE.flatMap(([id, rule]) => { const match = ownText.match(rule); return match ? [{ id, text: match[0] }] : []; });
  const prospective = PROSPECTIVE.flatMap(([id, rule]) => { const match = ownText.match(rule); return match ? [{ id, text: match[0] }] : []; });
  // Korean commonly omits the subject. Within a medication forum, a title
  // naming one's dose, treatment week, injection, or prescription is stronger
  // evidence than an English first-person pronoun requirement. Use the title,
  // not somebody else's reply in Hit Sentence, for this recovery rule.
  const title = normalize(row.Title).split(/\s+-\s+마운자로 마이너 갤러리/)[0];
  const koreanMedicationForum = source === "forum" && /마운자로 마이너 갤러리/u.test(normalize(row.Title));
  if (koreanMedicationForum) {
    const use = title.match(/(?:마운자로|위고비|마쫀쿠).{0,20}(?:써봤|시작했|두달|두달쨰|두달째|같이하니까)|\d+(?:\.\d+)?\s*(?:mg|미리)?\s*(?:\d+\s*(?:주\s*차|일차)|\d+펜차)|\d+(?:\.\d+)?\s*.{0,15}(?:꼽고|꽂고|부작용 거의 없었|효과가 많이 없|올린)|(?:첨맞을땐|맞기전이랑|첫 성지가로 사봄|약까지 겟또|실비거부|약 줄일까|병원가도 계속 증량)|(?:첫 마운자로|마운자로).{0,18}(?:사옴|\d+주\s*\d+kg\s*감량)/u);
    const question = title.match(/(?:\d+(?:\.\d+)?\s*(?:mg|미리)).{0,20}(?:올릴까|괜찮나요|괜찮으려나)|(?:첫 상담인데|증량도 괜찮나요|정체기 (?:꿀팁|질문)|마운자로.{0,15}(?:조언|병원 고르려|늦게 맞으면|고수님들)|낼마운자로간다)/u);
    if (use) experience.push({ id: "ko_forum_personal_dosing", text: use[0] });
    if (question) prospective.push({ id: "ko_forum_patient_support_question", text: question[0] });
  }
  const isRepost = hasQuote && !experience.length && !prospective.length;
  const media = /news|print/.test(source) || CLINICAL.test(text) && !personalSource;
  if (media) return make("media_or_research", experience.length || REPORTED.test(text) ? "reported_patient_story" : "news_or_research", 0.85, ["Editorial or research publication; quoted patient speech does not identify the author"], experience.map(x => x.text), experience.length > 0 || REPORTED.test(text));
  if (PROVIDER.test(ownText) || /\b(?:dr\.?|md|clinic)\b/i.test(author)) return make("provider_hcp", "professional_commentary", 0.75, ["Professional author metadata or treating-patients language"]);
  if (/\b(?:pharma|pharmaceutical|inc|ltd|llc)\b/i.test(author)) return make("company_or_commercial", "corporate_account", 0.75, ["Corporate author metadata"]);
  if (personalSource && CAREGIVER.test(text)) return make("caregiver", "likely_caregiver_experience", 0.72, ["Family relationship with treatment experience"], [text.match(CAREGIVER)![0]], true, true);
  const reportedPersonal = /김정은|스윙스|노사연|내 친구|내 여동생|뼈말라|말라.*애들|マンジャロ打ってる(?:友達|キャバ嬢)|話し始めた人間|マンジャロ打ったら[?？]|打ってるだろう|元木大介|日本肥満学会|ミセスコンテスト/iu.test(text);
  const educational = /\bi (?:took a deeper look|tried to|used to (?:watch|play)|use (?:twitter|youtube|instagram))|researchers find|clinical studies|glp-1 smart method|your pharmacist|no way i['’]m taking|faq|when should i start sculptra/iu.test(text);
  if (reportedPersonal) return make("community_observer", "reported_or_speculated_patient_account", 0.7, ["Third-party story or speculation does not establish personal treatment use"], [], REPORTED.test(text) || experience.length > 0);
  if (educational) return make("community_observer", "educational_or_general_commentary", 0.7, ["Educational, hypothetical, or non-personal commentary"]);
  if (personalSource && !isRepost && prospective.length && !experience.length) return make("patient", "prospective_patient", 0.65, ["Personal treatment consideration or patient-directed question", ...prospective.map(x => x.id)], prospective.map(x => x.text), true, true);
  if (personalSource && !isRepost && experience.length) return make("patient", "likely_personal_experience", 0.78, ["Personal-compatible source and explicit GLP-1 experience", ...experience.map(x => x.id)], experience.map(x => x.text), true, true);
  if (personalSource && !isRepost && prospective.length) return make("patient", "prospective_patient", 0.65, ["Personal treatment consideration or patient-directed question", ...prospective.map(x => x.id)], prospective.map(x => x.text), true, true);
  if (isRepost && [...EXPERIENCE, ...PROSPECTIVE].some(([, rule]) => rule.test(text))) return make("community_observer", "reshared_patient_account", 0.75, ["Repost of patient speech; authorship is not established"], [], true);
  if (source === "forum" && /마운자로 마이너 갤러리|(?:mounjaro|zepbound|wegovy|ozempic).*(?:support group|community)/iu.test(text)) return make("patient_community", "patient_community_discussion", 0.65, ["Treatment-community context without sufficient personal attribution"], [], true);
  if (personalSource) return make("community_observer", "general_community_commentary", 0.6, ["Community source; personal treatment status is not established"]);
  if (text.length < 35) return make("insufficient_context", "short_text_requires_review", 0.35, ["Available text is too short for a more specific attribution"]);
  return make("general_discussion", "unattributed_glp1_discussion", 0.5, ["Relevant GLP-1 content without personal or publication-role evidence"]);
}
