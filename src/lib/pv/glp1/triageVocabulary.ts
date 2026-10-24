/** Provisional lexical cues for triage only. Native-language assertion,
 * negation, exposure and product attribution still require qualified review.
 * These are not additions to the approved detection library. */
export const GLP1_TRIAGE_VERSION = "glp1-held-triage-2026-10-24.1";
export const TRIAGE_VOCABULARY_SOURCES = {
  ko: "https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=202301388",
  ja: "https://www.pmda.go.jp/files/000281140.pdf",
  fr: "https://www.ema.europa.eu/fr/documents/product-information/wegovy-epar-product-information_fr.pdf",
  pt: "https://www.ema.europa.eu/pt/documents/product-information/wegovy-epar-product-information_pt.pdf",
  es: "https://www.ema.europa.eu/es/documents/product-information/wegovy-epar-product-information_es.pdf",
};
// English keys must exist verbatim in the bundled FAERS reaction snapshot.
export const TRIAGE_REACTION_ALIASES: Record<string, Record<string, string[]>> = {
  Nausea: { ko: ["오심", "메스꺼움", "울렁"], ja: ["悪心", "吐き気"], fr: ["nausées", "nausée"], pt: ["náuseas", "náusea", "enjoo"], es: ["náuseas", "náusea"] },
  Vomiting: { ko: ["구토"], ja: ["嘔吐"], fr: ["vomissements", "vomissement"], pt: ["vómitos", "vômitos", "vomitando"], es: ["vómitos", "vomitando"] },
  Constipation: { ko: ["변비"], ja: ["便秘"], fr: ["constipation"], pt: ["prisão de ventre", "obstipação"], es: ["estreñimiento"] },
  Diarrhoea: { ko: ["설사"], ja: ["下痢"], fr: ["diarrhée", "diarrhées"], pt: ["diarreia"], es: ["diarrea"] },
  "Abdominal pain": { ko: ["복통"], ja: ["腹痛"], fr: ["douleurs abdominales"], pt: ["dor abdominal"], es: ["dolor abdominal"] },
  Headache: { ko: ["두통"], ja: ["頭痛"], fr: ["maux de tête"], pt: ["dor de cabeça"], es: ["dolor de cabeza"] },
  Fatigue: { ko: ["피로"], ja: ["疲労"], fr: ["fatigue"], pt: ["fadiga"], es: ["fatiga"] },
  Dizziness: { ko: ["어지러움", "어지럼"], ja: ["浮動性めまい", "めまい"], fr: ["vertiges"], pt: ["tonturas"], es: ["mareos"] },
};
// Corpus orthographic variants provide retrieval cues, not verified identities.
export const TRIAGE_PRODUCT_ALIASES = ["마운자로", "만자로", "위고비", "오젬픽", "삭센다", "리벨서스", "세마글루티드", "티르제파타이드", "マンジャロ", "ウゴービ", "オゼンピック", "リベルサス", "セマグルチド", "チルゼパチド", "semaglutida", "tirzepatida", "sémaglutide", "tirzépatide"];
export const TRIAGE_LANGUAGE_CODES: Record<string, string> = { english: "en", korean: "ko", japanese: "ja", portuguese: "pt", french: "fr", spanish: "es", german: "de", italian: "it", "chinese (simpl.)": "zh", "chinese (trad.)": "zh", arabic: "ar", russian: "ru" };
