/** Conservative pilot rules: topic membership and a high source score do not
 * establish that a passage supports a Corporate Affairs or Advocacy section. */
export const GLP1_MODULE_RELEVANCE_VERSION = "glp1-module-relevance-2026-10-29.1";

export function requiresGlp1SectionReview(area: string, moduleId: string) {
  return /^glp[ _-]?1$/i.test(area) && ["corporate_affairs", "advocacy"].includes(moduleId);
}

const topic = /\b(?:glp[ -]?1s?|glucagon.like peptide|semaglutid\w*|tirzepatid\w*|liraglutid\w*|dulaglutid\w*|exenatid\w*|lixisenatid\w*|ozempic|wegovy|rybelsus|mounjaro|zepbound|saxenda|victoza|trulicity|byetta|bydureon|adlyxin)\b|마운자로|만자로|위고비|오젬픽|삭센다|マンジャロ|オゼンピック|ウゴービ|リベルサス|司美格鲁肽|司美格魯肽|替尔泊肽|替爾泊肽|مونجارو|أوزمبيك|اوزمبيك|ويجوفي/iu;
const signals: Record<string, RegExp> = {
  reputation: /\b(?:trust\w*|distrust\w*|credib\w*|reputation\w*|ethic\w*|controvers\w*|critic(?:ism|isms|ize|ized|izes|izing|ise|ised|ises|ising|s)?|praise\w*|responsib\w*)\b|신뢰|불신|논란|비판|信頼|不信|批判|confian[çz]a|credibil|Vertrauen/iu,
  stakeholders: /\b(?:patients?|providers?|doctors?|clinicians?|communities|community|stakeholders?|public opinion)\b|환자|의사|환우|患者|医師|pacient|comunidade|comunidad/iu,
  advocacy: /\b(?:patient advoc\w*|patient (?:groups?|organizations?|associations?)|support groups?|health (?:coalitions?|foundations?))\b|환자\s*단체|환우회|患者会|患者団体|患者组织|患者組織|associa[çc][aã]o.{0,25}pacient|asociaci[oó]n.{0,25}pacient/iu,
  narratives: /\b(?:misinformation|backlash|controvers\w*|debate\w*|critic(?:ism|isms|ize|ized|izes|izing|ise|ised|ises|ising|s)?|stigma\w*|narrative\w*|public concern)\b|논란|비판|가짜|批判|偽物|不信|desinforma[çc]|desinformaci[oó]n/iu,
  community_priorities: /\b(?:patient|caregiver|community|communities)\b.{0,90}\b(?:need\w*|burden\w*|support|quality of life|concern\w*)\b|\b(?:need\w*|burden\w*|support)\b.{0,90}\b(?:patient|caregiver|community|communities)\b|환자.{0,50}(?:필요|부담|지원)|患者.{0,50}(?:必要|負担|支援)|pacient.{0,60}(?:necess|apoio|neces|apoyo)/iu,
  access_equity: /\b(?:access to (?:treatment|medication|care|glp)|afford\w*|costs?|prices?|copay\w*|insurance|coverage|reimbursement|shortages?|health equit\w*|inequit\w*|disparit\w*|underserved)\b|가격|비용|보험|품절|비싸|保険|費用|価格|入手|价格|價格|custo|pre[çc]o|cobertura|seguro|acceso|Zugang|Kosten|Versicherung/iu,
  policy_awareness: /\b(?:polic(?:y|ies|ymakers?)|regulat\w*|legislation|government|fda|ema|anvisa|reimbursement)\b|정책|규제|정부|승인|식약처|規制|承認|政策|政府|批准|regula[çc]|regulaci[oó]n|aprova[çc]|aprobaci[oó]n|Zulassung/iu,
};
signals.organizations = signals.advocacy;

export function isExplicitPromotion(text: string) {
  return /#\w*partner\b|#(?:ad|sponsored)\b|\b(?:paid partnership|sponsored by|affiliate link|use my code|shop now|buy now|our prices|we['’]ll sell)\b/iu.test(text);
}

export function matchesGlp1ModuleSection(sectionId: string, text: string): boolean {
  const signal = signals[sectionId];
  if (!signal) return false;
  // A medication hashtag, channel name or quoted handle alone cannot connect
  // unrelated criticism/campaigns/product copy to the treatment topic.
  const cleaned = text.replace(/https?:\/\/\S+/gu, " ").replace(/[#@][\p{L}\p{N}_・-]+/gu, " ")
    .replace(/-\s*마운자로 마이너 갤러리/gu, " ")
    .replace(/\b(?:body|self)[ -]criticism\b|\blabel trust\b|\bprice competition\b/giu, " ")
    .replace(/\bglp[ -]?1[ -]friendly\b/giu, " ");
  const passages = cleaned.split(/[.!?。！？;\n]+/u).map(value => value.trim()).filter(Boolean);
  return passages.some((passage, index) => {
    if (topic.test(passage)) {
      // Bound the matching passage so distant keywords cannot establish a link.
      for (const match of passage.matchAll(new RegExp(topic.source, "giu"))) {
        const start = match.index || 0;
        const window = passage.slice(Math.max(0, start - 120), start + match[0].length + 120);
        if (sectionId === "access_equity" && /\b(?:price|cost) of (?:goods|pizza|food|lotion)\b/i.test(window)) continue;
        if (signal.test(window)) return true;
      }
    }
    // A directly following sentence may refer back to the named treatment.
    return index > 0 && topic.test(passages[index - 1]) &&
      /^(?:it|its|this (?:treatment|medication|drug)|these (?:treatments|medications|drugs)|they|their)\b/i.test(passage) && signal.test(passage.slice(0, 220));
  });
}
