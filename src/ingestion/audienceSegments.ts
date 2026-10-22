/** Client-facing roles and conversation types are separate, exclusive axes. */
export const AUDIENCE_ROLES = {
  patient: { label: "Patients & prospective patients", description: "Personal treatment experiences or consideration of treatment." },
  caregiver: { label: "Caregivers", description: "A family member or supporter describes another person's treatment and care." },
  family_peer: { label: "Family & peers", description: "A personal connection is stated, without an established caregiving role." },
  provider_hcp: { label: "Healthcare professionals", description: "Self-described clinical credentials or professional practice language." },
  clinic_telehealth: { label: "Clinics, pharmacies & care services", description: "Organization-led treatment, dispensing or service information." },
  company_or_commercial: { label: "Companies & commercial accounts", description: "Corporate communications, product promotion or commercial services." },
  news_media: { label: "News & media", description: "News publications, newsroom accounts or identified reporting voices." },
  researcher: { label: "Research & scientific organizations", description: "An identified research organization, academic role or scientific publication." },
  wellness_creator: { label: "Wellness, nutrition & fitness creators", description: "Self-described coaching, fitness or nutrition content; clinical credentials are not assumed." },
  health_educator: { label: "Health educators & commentators", description: "Health-focused commentary with no established clinical credentials in the available metadata." },
  advocacy: { label: "Advocacy & patient organizations", description: "An organization or self-described advocate representing patient or public interests." },
  legal_services: { label: "Legal professionals & services", description: "Self-described legal practices or legal-service outreach." },
  public_authority: { label: "Public health & regulatory bodies", description: "An account identifies itself as a public health agency or regulator." },
  investor_analyst: { label: "Market & investment commentators", description: "An investing role or explicit financial analysis of the GLP-1 market." },
  public_discussion: { label: "General public discussion", description: "The post expresses a public view; a professional or personal treatment role is not established." },
  patient_community: { label: "Patient support communities", description: "Treatment-community participation without sufficient personal attribution." },
  media_or_research: { label: "Published news & research", description: "Publication evidence without a more specific source role." },
  community_observer: { label: "General community discussion", description: "Legacy community classification." },
  general_discussion: { label: "General discussion", description: "Relevant content without an attributable speaker role." },
  off_topic: { label: "Outside the medication topic", description: "No supported medication context, including product-name collisions." },
  insufficient_context: { label: "Limited-context mentions", description: "The available excerpt cannot support a more specific role." },
} as const;
export type AudienceRole = keyof typeof AUDIENCE_ROLES;

export const CONVERSATION_SEGMENTS = {
  personal_experience: "Personal treatment experience",
  treatment_consideration: "Treatment consideration & questions",
  caregiver_experience: "Caregiver experience",
  family_peer_story: "Family or peer treatment stories",
  shared_patient_story: "Shared or reported patient stories",
  news_reporting: "News reporting & sharing",
  research_discussion: "Research & clinical evidence discussion",
  professional_guidance: "Clinical guidance & professional practice",
  commercial_promotion: "Product or service promotion",
  nutrition_lifestyle: "Nutrition, fitness & lifestyle guidance",
  access_affordability: "Access, cost & availability",
  policy_ethics: "Policy, regulation & ethics",
  legal_action: "Lawsuits & legal outreach",
  treatment_comparison: "Treatment comparisons & alternatives",
  treatment_outcomes: "Weight, appetite & treatment outcomes",
  treatment_administration: "Dosing & medication administration",
  link_sharing: "Links shared without added commentary",
  cultural_reference: "Cultural & nonliteral medication references",
  business_investment: "Business & investment discussion",
  celebrity_body_image: "Celebrity, appearance & body-image commentary",
  humor_satire: "Humor & satire",
  information_seeking: "Medication information requests",
  safety_opinion: "Safety concerns & treatment opinions",
  brief_reaction: "Brief social reactions",
  general_medication_discussion: "General medication discussion",
  limited_context: "Limited-context mentions",
  off_topic: "Outside the medication topic",
} as const;
export type ConversationSegment = keyof typeof CONVERSATION_SEGMENTS;
export type AudienceSegmentation = {
  previousAudience: AudienceRole;
  contentSegment: ConversationSegment;
  roleBasis: "personal_experience" | "author_metadata" | "professional_self_description" | "relationship_self_description" | "publication_metadata" | "content_only" | "limited_context";
  roleEvidence: string[];
};

type BaseClassification = {
  audience: AudienceRole; designation: string; eligiblePatientVoice: boolean;
  patientContent: boolean; confidence: number; signals: string[]; matchedEvidence: string[];
  reviewRequired: boolean;
};
const decode = (value: unknown) => {
  const text = String(value || "");
  return (text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text).normalize("NFKC").replace(/[‘’]/g, "'").trim();
};

const MEDIA_ACCOUNT = /news(?:room|hour)?\b|newsguru|\b(?:journalist|reporter|rádio|radio|notícias|noticias|espectador|newstalk|tvn|wbay|knn|jtbc|sbs|mbc|ytn|pbs|ndtv|cnbc|cnn|reuters|bloomberg)\b|뉴스|신문|경제TV|記者|報道|新聞|diário do brasil|pharmacy practice news|chemist\+druggist|managed healthcare executive/iu;
const LEGAL_ACCOUNT = /\b(?:lawyer|attorney|law firm|legal services)\b|弁護士|변호사/iu;
const AUTHORITY_ACCOUNT = /\b(?:food and drug administration|european medicines agency|anvisa|ministry of health|health department)\b|^(?:FDA|EMA)\s*@?(?:US_FDA|EMA_News)?\s*$|厚生労働省|식품의약품안전처/iu;
const CLINIC_ACCOUNT = /clinic|pharmacy|pharmacies|telehealth|medspa|med spa|centro\s*medico|centromedico|health (?:center|centre)|healthcenter|healthcentre|medical cosmetics|sexual_health|ssmhealth|nowpatientapp|quickmd|hims\s*(?:&|and)\s*hers|병원|의원|クリニック|薬局|オンライン診療/iu;
const HCP_ACCOUNT = /\b(?:doctor|nurse|pharmacist|physician|surgeon|endocrinologist|endocrinologista|dietitian|dietician|registered dietitian|pharmd|mbbs|rn|md|nutriólogo|nutrióloga|nutriologa|nutrizionista|médico|medico|médica)\b|\bm\.d\.|(?:doctor|nurse)[._]|의사|약사|医師|薬剤師|看護師|栄養士/iu;
const DOCTOR_TITLE = /\b(?:dr|dra|dott|dottore)\b/iu;
const CLINICAL_SELF = /\b(?:my|our) patients?\b|\bin (?:my|our) (?:practice|clinic)\b|\b(?:i|we) (?:prescribe|administer|diagnose|treat patients)\b|\bwe (?:have|see|treat) (?:now )?patients\b|\b(?:i am|i'm|as a) (?:nurse|doctor|physician|pharmacist)\b|저희 병원|私の患者/iu;
const RESEARCH_ACCOUNT = /\b(?:clinical research|research institute|research center|research centre|university|universidade|universidad|professor|phd|scientist)\b|研究所|大学|대학교|연구소/iu;
const ADVOCACY_ACCOUNT = /\b(?:advocacy|patient advocate|patient association|patient foundation|patient network|obesity action|diabetes uk)\b|患者会|患者団体|환자단체/iu;
const INVESTOR_ACCOUNT = /\b(?:investing|investments?|investor|stock analyst|equity research|portfolio manager|financial analyst)\b|投資|투자/iu;
const WELLNESS_ACCOUNT = /\b(?:nutrition|nutricion|nutrição|fitness|wellness coach|health coach|weight loss coach|personal trainer|biohacking)\b|(?:^|[ @._])nutri[._a-z]|diet coach|ダイエットコーチ/iu;
const COMPANY_ACCOUNT = /\b(?:pharma|pharmaceutical|biotech|corporation|inc|ltd|llc|novo nordisk|eli lilly)\b|biocareltd/iu;
const FINANCIAL = /\b(?:earnings|revenue|valuation|share price|stock price|shareholders|market cap|bullish|bearish|nvo|lly|investment thesis|supply chain)\b|売上|株価|投資|주가|매출|ação|ações|receita|valoriza/iu;
const NEWS_CONTENT = /https?:\/\/[^\s]*(?:news|reuters|bbc\.|cnn\.|wsj\.|bloomberg|science-news)|\b(?:breaking news|according to|reports that|read (?:the |more)|fda approves|anvisa aprova|polícia rodoviária)\b|\[앵커\]|\[기자\]|취재|뉴스|報道|発表した|速報/iu;
const CLINICAL_CONTENT = /\b(?:clinical trial|phase [123]|phase iii|randomized|randomised|meta.analysis|study (?:finds|found)|researchers|peer.reviewed|evidence suggests)\b|임상|연구 결과|臨床|研究結果|ensaio clínico|ensayo clínico/iu;
const PROMOTION = /\b(?:book (?:your|now)|call today|our price|buy now|schedule (?:your|a)|dm (?:me|us)|use (?:my |the )?code|affiliate|sponsored|paid partnership|link (?:in|na) bio|agendar|me chama|coaching clients|launch your|our program|free case evaluation|top.*selling items)\b|#(?:ad|pr)\b|割引|クーポン|紹介キャンペーン|通販|円(税込)|문의.*예약|예약.*문의/iu;
const NUTRITION = /\b(?:nutrition|protein|meal plan|meal prep|recipes?|hydration|muscle maintenance|strength training|alimentação|proteína|refeições|dieta)\b|栄養|筋トレ|食事管理|식단|단백질/iu;
const POLICY = /\b(?:regulat\w*|policy|medicare|medicaid|ethics|ethical|government|public health|ban\w*|health insurance system)\b|規制|不適正利用|보험.*부담|오남용|규제|정부|ética|anvisa/iu;
const ACCESS = /\b(?:cost|price|afford\w*|insurance|coverage|shortage|availability|prescription|access|coupon|preço|custo|cobertura)\b|価格|処方|保険|値段|薬代|個人輸入|購入|얼마|가격|처방|재고|보험|비싸/iu;
const CELEBRITY = /\b(?:celebrity|celebrities|hollywood|ozempic face|ariana grande|kelly osbourne|sharon osbourne|jelly roll|body image|anorexia|skinny|body.sham\w*|fatphobi\w*)\b|김정은|스윙스|노사연|연예인|여돌|아이돌|痩せすぎ|ガリガリ|芸能|恭一郎|激やせ|gordofobi|magreza/iu;
const HUMOR = /\b(?:lol|lmao|rofl|joke|meme|satire|who needs ozempic)\b|😂|🤣|ㅋㅋ|笑|草/iu;
const QUESTION = /\b(?:how (?:does|do|can)|what (?:is|are|does)|does anyone|can anyone|where can|any advice|anyone know|thoughts on)\b|[?？]|궁금|질문|教えて/iu;
const SAFETY = /\b(?:side effect|risk|danger|safe|safety|harm|concern|stigma|shouldn't|should not|against)\b|副作用|失明|危険|부작용|위험|안전|riesgo|efeitos colaterais/iu;
const GUIDANCE = /\b(?:how to|dose|dosing|administration|prescrib\w*|clinical|patients?|medical advice|treatment plan|counsel\w*)\b|処方|服用|투약|복용|환자|tratamento|tratamiento/iu;
const LEGAL_CONTENT = /\b(?:lawsuit|litigation|class action|legal action|case evaluation|lawyer|attorney)\b|訴訟|소송/iu;
const COMPARISON = /\b(?:versus|vs\.?|compared (?:to|with)|comparison|alternatives?|switching from|oral (?:or|vs) injectable)\b|比較|乗り換え|どっち|어느.*좋|비교|갈아타/iu;
const OUTCOMES = /\b(?:weight loss|weight regain|appetite|blood sugar|a1c|food noise|metabolic|insulin resistance|lose weight)\b|体重|食欲|血糖|痩せ|減量|リバウンド|살.*빠|감량|식욕|혈당|emagrec|perda de peso/iu;
const ADMINISTRATION = /\b(?:dosage|dosing|titration|missed dose|inject\w*|milligrams?|weekly dose)\b|注射|投与|服用|용량|주사|복용|증량/iu;
const FAMILY = /\bmy (?:wife|husband|partner|mother|father|mom|dad|sister|brother|friend|son|daughter)\b|내 (?:친구|여동생|남동생)|うちの(?:弟|兄|母|父)|(?:mi|minha|meu) (?:madre|padre|mãe|pai|amigo|amiga)/iu;

/** Only establishes a specific role from source metadata, self-description, or
 * explicit personal evidence. Content about medicine alone never proves an HCP.
 */
export function segmentAudience<T extends BaseClassification>(row: Record<string, unknown>, base: T): T & AudienceSegmentation {
  const comment = /comment/i.test(decode(row["Content Type"])) || /^comment on\b/i.test(decode(row["Author Name"]));
  const forumReply = /forum post reply/i.test(decode(row["Content Type"]));
  const source = decode(row["Source Type"]);
  const author = comment ? "" : `${decode(row["Author Name"])} ${decode(row["Author Handle"])}`.trim();
  const fields = [...new Set((comment || forumReply ? [row["Opening Text"], row["Hit Sentence"]] : [row.Title, row["Opening Text"], row["Hit Sentence"]]).map(decode).filter(Boolean))];
  const text = fields.join(" ");
  const quoted = /^quote$/iu.test(decode(row["Content Type"])) || fields.some(field => /^\s*(?:RT|QT)\s+@/i.test(field));
  const ownText = quoted ? fields.filter(field => field.includes(";")).map(field => field.slice(field.indexOf(";") + 1)).join(" ") : text;
  let audience = base.audience;
  let roleBasis: AudienceSegmentation["roleBasis"] = base.eligiblePatientVoice ? "personal_experience" : "content_only";
  let roleEvidence = [...base.matchedEvidence];
  let confidence = base.confidence;
  let eligiblePatientVoice = base.eligiblePatientVoice;
  let designation = base.designation;
  let patientContent = base.patientContent;
  const attribute = (role: AudienceRole, rule: RegExp, basis: AudienceSegmentation["roleBasis"] = "author_metadata") => {
    const match = author.match(rule);
    if (!match) return false;
    audience = role; roleBasis = basis; roleEvidence = [match[0]]; confidence = 0.78;
    return true;
  };
  if (!base.eligiblePatientVoice && audience !== "off_topic") {
    // Do not inherit a quoted author's credentials or a parent channel's role.
    if (attribute("news_media", MEDIA_ACCOUNT)) { /* newsroom */ }
    else if (attribute("public_authority", AUTHORITY_ACCOUNT)) { /* self-identified agency */ }
    else if (attribute("advocacy", ADVOCACY_ACCOUNT)) { /* represented interests */ }
    else if (attribute("legal_services", LEGAL_ACCOUNT)) { /* legal-service source */ }
    else if (attribute("researcher", RESEARCH_ACCOUNT)) { /* academic affiliation */ }
    else if (attribute("clinic_telehealth", CLINIC_ACCOUNT)) { /* organization, not an individual clinician */ }
    else if (attribute("provider_hcp", HCP_ACCOUNT)) { /* self-described credentials */ }
    else if (CLINICAL_SELF.test(ownText)) {
      audience = "provider_hcp"; roleBasis = "professional_self_description"; roleEvidence = [ownText.match(CLINICAL_SELF)![0]]; confidence = 0.78;
    }
    else if (attribute("company_or_commercial", COMPANY_ACCOUNT)) { /* corporate author */ }
    else if ((!/forum/iu.test(source) || FINANCIAL.test(ownText)) && attribute("investor_analyst", INVESTOR_ACCOUNT)) { /* investing account */ }
    else if (attribute("wellness_creator", WELLNESS_ACCOUNT)) { /* credentials not inferred */ }
    else if (attribute("health_educator", DOCTOR_TITLE)) { /* Doctor title alone does not establish clinical credentials */ }
    else if (base.audience === "provider_hcp") {
      audience = "public_discussion"; roleBasis = "content_only"; roleEvidence = []; confidence = 0.55;
    }
    else if (base.audience === "media_or_research") {
      audience = /pubmed|ncbi\.nlm|clinicaltrials\.gov|nejm\.org|thelancet|nature\.com|jamanetwork|bmj\.com/iu.test(decode(row.URL)) ? "researcher" : "news_media";
      roleBasis = "publication_metadata"; roleEvidence = [decode(row["Source Type"]), decode(row.URL)].filter(Boolean);
    } else if (base.audience === "community_observer" || base.audience === "general_discussion") {
      audience = "public_discussion";
      if (FAMILY.test(ownText)) {
        audience = "family_peer"; roleBasis = "relationship_self_description"; roleEvidence = [ownText.match(FAMILY)![0]]; confidence = 0.66; patientContent = true;
      } else if (!quoted && FINANCIAL.test(ownText) && /\b(?:thesis|valuation|bullish|bearish|market cap|earnings|revenue|nvo|lly)\b|株価|売上|주가|매출/iu.test(ownText)) {
        audience = "investor_analyst"; roleBasis = "content_only"; roleEvidence = [ownText.match(FINANCIAL)![0]]; confidence = 0.62;
      } else if (!quoted && PROMOTION.test(ownText)) {
        audience = "company_or_commercial"; roleEvidence = [ownText.match(PROMOTION)![0]]; confidence = 0.7;
      }
    }
    // Recover explicit subject-omitting treatment diaries without attributing
    // a forum thread title or a repost to the current writer.
    if (audience === "public_discussion" && !quoted && !comment && !forumReply) {
      const diary = ownText.match(/(?:マンジャロ|ウゴービ|リベルサス).{0,35}\d+\s*日目.{0,30}\d+(?:\.\d+)?\s*(?:kg|キロ)|(?:マンジャロ|ウゴービ).{0,12}(?:\d+日目).{0,25}(?:効果感じ|食事を受け付け)|(?:위고비|마운자로).{0,30}\d+(?:\.\d+)?\s*(?:쓰다가|맞다가)/u);
      if (diary) {
        audience = "patient"; designation = "likely_personal_experience"; eligiblePatientVoice = true; patientContent = true;
        roleBasis = "personal_experience"; roleEvidence = [diary[0]]; confidence = 0.72;
      }
    }
  }

  let contentSegment: ConversationSegment = "general_medication_discussion";
  if (audience === "off_topic") contentSegment = "off_topic";
  else if (eligiblePatientVoice) contentSegment = audience === "caregiver" ? "caregiver_experience" : designation === "prospective_patient" ? "treatment_consideration" : "personal_experience";
  else if (audience === "family_peer") contentSegment = "family_peer_story";
  else if (base.designation === "reshared_patient_account" || base.designation === "reported_patient_story") contentSegment = "shared_patient_story";
  else if (LEGAL_CONTENT.test(ownText)) contentSegment = "legal_action";
  else if (PROMOTION.test(ownText) || ["commercial_or_promotional", "commercial_patient_testimonial", "spam_or_search_manipulation"].includes(designation)) contentSegment = "commercial_promotion";
  else if (CLINICAL_CONTENT.test(ownText)) contentSegment = "research_discussion";
  else if (audience === "news_media" || NEWS_CONTENT.test(ownText)) contentSegment = "news_reporting";
  else if (FINANCIAL.test(ownText)) contentSegment = "business_investment";
  else if (POLICY.test(ownText)) contentSegment = "policy_ethics";
  else if (CELEBRITY.test(text) || base.designation === "reported_or_speculated_patient_account") contentSegment = "celebrity_body_image";
  else if (/ozempic emojis|art needs ozempic|fortnite|ozempic.*(?:software|supercomputer)/iu.test(ownText)) contentSegment = "cultural_reference";
  else if (COMPARISON.test(ownText)) contentSegment = "treatment_comparison";
  else if (ACCESS.test(ownText)) contentSegment = "access_affordability";
  else if (["provider_hcp", "clinic_telehealth"].includes(audience) && GUIDANCE.test(ownText)) contentSegment = "professional_guidance";
  else if (NUTRITION.test(ownText)) contentSegment = "nutrition_lifestyle";
  else if (QUESTION.test(ownText)) contentSegment = "information_seeking";
  else if (SAFETY.test(ownText)) contentSegment = "safety_opinion";
  else if (HUMOR.test(ownText)) contentSegment = "humor_satire";
  else if (ADMINISTRATION.test(ownText)) contentSegment = "treatment_administration";
  else if (OUTCOMES.test(ownText)) contentSegment = "treatment_outcomes";
  else if (/https?:/iu.test(ownText) && ownText.replace(/https?:\s*\/\/\S+/g, "").trim().length < 30) contentSegment = "link_sharing";
  else if (ownText.replace(/https?:\/\/\S+|@\S+/g, "").trim().length < 65) contentSegment = "brief_reaction";
  if (audience !== "off_topic" && (audience === "insufficient_context" || !text)) contentSegment = "limited_context";
  return {
    ...base, audience, designation, eligiblePatientVoice, patientContent, confidence,
    reviewRequired: base.reviewRequired || roleBasis === "content_only" || confidence < 0.7,
    signals: [...base.signals, `Role: ${AUDIENCE_ROLES[audience].label}`, `Role basis: ${roleBasis}`, `Conversation: ${CONVERSATION_SEGMENTS[contentSegment]}`],
    matchedEvidence: [...new Set([...base.matchedEvidence, ...roleEvidence])],
    contentSegment, roleBasis, roleEvidence, previousAudience: base.audience,
  };
}
