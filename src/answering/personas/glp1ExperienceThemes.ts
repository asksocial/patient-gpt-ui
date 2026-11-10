import { searchRecordText } from "../search/searchSubjects";
import type { CanonicalFinding } from "../models/finding";
import { buildCorpusCharts } from "./buildCorpusCharts";
import type { PersonaRecord } from "./buildPersonaIntelligence";

export const GLP1_EXPERIENCE_LABEL_VERSION = 1;

// These are discussion topics, not diagnoses, causal assessments or patient
// prevalence. Negated experiences and questions still support a topic label.
// Medication names and forum names alone never support a specific experience.
const themes: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: "digestive", label: "Digestive experiences", pattern: /\b(?:nause\w*|vomit\w*|constipat\w*|diarrh\w*|bloat\w*|reflux|heartburn|burp\w*|digestive|stomach (?:pain|ache)|shitting)\b|메스[꺼껍]|울렁|구토|토했|변비|설사|소화|속쓰|속 쓰|복통|똥|장염|위가.{0,8}약|위장|역류|트림|吐き気|気持ち悪|嘔吐|便秘|下痢|胃痛|胃もたれ|逆流|悪心|恶心|噁心|呕吐|腹泻|腹瀉|便秘|náusea|enjoo|vômit|diarreia|constipação/giu },
  { id: "safety", label: "Other side effects and safety questions", pattern: /\b(?:side[- ]effects?|adverse|safety|unsafe|pancreatitis|dehydrat\w*|dizzy|dizziness|headache|hair loss|vision|hypoglyc\w*|allerg\w*|rash|pain)\b|부작용|탈모|두통|어지러|어지럽|저혈당|췌장염|탈수|발진|저혈압|근육통|통증|고통|副作用|脱毛|抜け毛|低血糖|膵炎|めまい|頭痛|脱水|视力|視力|胰腺炎|efeitos colaterais|efectos secundarios/giu },
  { id: "reproductive", label: "Reproductive health and medication interactions", pattern: /\b(?:pregnan\w*|contracept\w*|birth control|pcos|menstrua\w*|menstrual periods?|breastfeed\w*|drug interaction)\b|피임|임신|생리|다낭성|수유|妊娠|避妊|生理|月経|授乳|怀孕|懷孕|避孕|gravidez|anticoncep\w*/giu },
  { id: "energy", label: "Energy, mood and daily life", pattern: /\b(?:fatigue|tired|exhaust\w*|energy|depress\w*|anxious|anxiety|sleep|insomnia|daily life|quality of life)\b|피로|피곤|무기력|기운|힘이.{0,6}빠|우울|불안|걱정|숙면|수면|불면|잠.{0,8}(?:안|못)|眠気|眠い|だる|倦怠|疲れ|うつ病|不眠|疲劳|疲勞|焦虑|焦慮/giu },
  { id: "appearance", label: "Body image, skin and social perceptions", pattern: /\b(?:body image|loose skin|sagging|ozempic face|stigma|shame|judg(?:e)?ment|cheating|easy way out|guilt)\b|살처|살 처|처짐|팔자|턱살|볼살|탄력|얼굴형|외모|죄책감|얼사인증|피부|모욕|たるみ|たるん|見た目|皮膚|ほうれい線|げっそり|自尊|尊厳/giu },
  { id: "access", label: "Access, cost and availability", pattern: /\b(?:insurance|coverage|copay|co-pay|prior authori\w*|afford\w*|costs?|prices?|expensive|shortage|stock|pharmac\w*|prescription|prescrib\w*|clinic|appointment)\b|가격|비용|약값|진료비|처방비|만원|만 원|가성비|비싸|비쌈|실비|면책|약관|보험|월납|의원|구매|구입|원가|수수료|헐값|통관|반입|돈.{0,8}(?:아까|있어|없|주|달라)|재고|품절|성지|약국|처방|병원|保険|自費|価格|費用|円|品切|在庫|処方|予約|保險|保险|价格|價格|preço|custo|receita|order(?:ing)? (?:my |the )?(?:mounjaro|medication|prescription|ozempic|wegovy)/giu },
  { id: "maintenance", label: "Maintenance, stopping and restarting", pattern: /\b(?:maintenan\w*|regain\w*|restart\w*|discontinu\w*|stopp?(?:ing|ed) (?:taking|treatment|ozempic|wegovy|mounjaro|zepbound)|off (?:ozempic|wegovy|mounjaro|zepbound))\b|약.{0,5}줄일|단약|요요|유지|재시작|끊|안맞은지|안 맞은지|마지막 주사|リバウンド|維持|中止|再開|やめ|辞め|停薬|停药|反弹|反彈|desmame|reganho/giu },
  { id: "outcomes", label: "Weight, metabolic outcomes and effectiveness", pattern: /\b(?:weight|weigh\w*|lost\s+\d|weight loss|fat loss|regain|plateau|blood sugar|glucose|a1c|hba1c|effective\w*|it works|worked|helped|bmi)\b|체중|몸무게|공복무게|감량|정체기|효과|살찌|살쪄|살안쪘|빠지|빠짐|빠질|빠졌|빠진|잘빼|빼고|못빼|안빠|안 빠|살빼|살 빼|키로|키러|복구|혈당|体重|体脂肪|痩せ|痩し|減量|減って|落ち|効果|血糖|减重|減重|瘦|减肥|減肥|perda de peso|emagrec\w*|adelgaz\w*|\d+(?:\.\d+)?\s*(?:kg|lbs?|pounds|キロ|킬로)/giu },
  { id: "appetite", label: "Appetite, hunger and eating changes", pattern: /\b(?:appetite|cravings?|food noise|hungry|hunger|fullness|binge|eat(?:ing)? less|couldn't eat|can't eat)\b|식욕|배고|배 고|입터|입 터|포만|공복|폭식|허기|안땡|안 땡|못머금|못먹|못 먹|식탐|덜먹|덜 먹|食欲|空腹|満腹|食べられ|食べれ|食事量|食欲|饥饿|飢餓|apetite|fome|antojo/giu },
  { id: "dosing", label: "Dosing, injections and treatment routines", pattern: /\b(?:dos(?:e|es|ing)|titration|inject\w*|shots?|needles?|pens?|storage|refrigerat\w*|weekly|aplicar|microdos\w*|splitting|stretching)\b|주사|증량|용량|투약|펜|보관|냉장|얼었|살얼음|스타트|주기|꼽|꽂|맞은|맞았|맞앗|첫방|첫 방|첫날|맞기|맞고|맞으|맞아|맞을|注射|打っ|打つ|増量|減薬|用量|本目|💉|\d+(?:\.\d+)?\s*(?:mg|밀리|미리)/giu },
  { id: "nutrition", label: "Nutrition, meals and physical activity", pattern: /\b(?:protein|nutrition|meals?|alcohol|drinking|diet|exercise|workout|working out|gym|muscle|hydrat\w*|vitamin|supplement|calories?)\b|식단|식사|아침밥|밥|먹|단백질|프로틴|단식|운동|러닝|걷기|헬스|근육|칼로리|복근|컵누들|다크초코|아구찜|곱창|근손실|유산소|자전거|산책|닭가슴살|두부|피자|브런치|요거트|쌀국수|땅콩버터|호두과자|코코넛|흑임자|콩담백면|더단백|고메스퀘어|조미김|맛있|맛잇|나트륨|술|탄수|저탄고지|고기|영양|샐러드|식이|食事|食べ|筋トレ|筋肉|運動|栄養|プロテイン|カロリー|レッグ|エアロバイク|饮食|飲食|运动|運動|proteína|exercício/giu },
  { id: "journey", label: "Treatment consideration and progress updates", pattern: /\b(?:start\w*|began|begin\w*|consider\w*|journey|progress|experience|switch\w*|thinking (?:of|about)|on (?:ozempic|wegovy|mounjaro|zepbound)|use (?:ozempic|wegovy|mounjaro|zepbound))\b|시작|고민|후기|일차|주차|주 차|달차|달째|달쨰|처음|첫 |해야겠|맞을까|맞아볼까|맞아봤|써봤|사용자|갈아타|뉴비|안 맞는 이유|日目|ヶ月|か月|打ちたい|始め|使って|使い|使用|乗り換|検討|使う|tomando|tomo|usando|uso|comecei|quero tomar|caiu no mounjaro/giu },
];

type ExperienceRecord = PersonaRecord & { title?: string; canonicalClaim?: string };

export function classifyGlp1ExperienceThemes(record: ExperienceRecord) {
  const text = searchRecordText(record).replace(/https?:\/\/\S+/g, " ");
  const title = String(record.rawMetadata?.fields?.Title || record.title || "").normalize("NFKC").replace(/https?:\/\/\S+/g, " ");
  const matches = themes.flatMap(theme => {
    const evidence = [...new Set(text.match(theme.pattern) || [])];
    return evidence.length ? [{ id: theme.id, label: theme.label, evidence }] : [];
  });
  // Prefer the explicitly stated subject of a post to an incidental detail in
  // its body. Specific topics break ties before general routines/updates.
  const titleMatch = matches.find(match => {
    const pattern = themes.find(theme => theme.id === match.id)!.pattern;
    return Boolean(title.match(pattern));
  });
  return { primary: titleMatch || matches[0], matches };
}

export function buildGlp1ExperienceCharts(findings: CanonicalFinding[], options: { showAllMarkets?: boolean } = {}) {
  const chart = buildCorpusCharts(findings.map(finding => ({
    symptoms: [classifyGlp1ExperienceThemes(finding).primary?.label || ""].filter(Boolean),
    country: finding.countries?.[0] || (finding as CanonicalFinding & { country?: string }).country,
  })), { ...options, allBurdens: true });
  chart.burdens.title = "Most-Supported Experience Themes";
  chart.burdens.labelVersion = GLP1_EXPERIENCE_LABEL_VERSION;
  chart.burdens.segments = chart.burdens.segments.map(segment => segment.id === "remainder"
    ? { ...segment, label: "No specific experience stated" } : segment);
  chart.burdens.note = "Each post is counted once under a supported topic, prioritizing the title and specific experiences over general routines and updates. Labels include questions and negated experiences; they do not establish side effects, causation or patient prevalence. Brief reactions without a specific experience remain unclassified.";
  return chart;
}
