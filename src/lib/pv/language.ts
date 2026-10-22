/** Explicit ISO 639-2/T mappings. Unknown codes stay unknown; no language is inferred from text. */
const ISO_LANGUAGES: Record<string, string> = {
  en: "eng", fr: "fra", es: "spa", de: "deu", it: "ita", pt: "por", nl: "nld",
  ar: "ara", zh: "zho", ja: "jpn", ko: "kor", ru: "rus", hi: "hin", bn: "ben",
  tr: "tur", pl: "pol", uk: "ukr", vi: "vie", th: "tha", id: "ind", ms: "msa",
  sv: "swe", da: "dan", no: "nor", fi: "fin", el: "ell", he: "heb", cs: "ces",
  ro: "ron", hu: "hun", ta: "tam", te: "tel", ur: "urd", fa: "fas", sw: "swa",
};
export function pvLanguageCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toLowerCase().replace(/_/g, "-");
  if (Object.values(ISO_LANGUAGES).includes(code)) return code;
  // Validate the complete tag before accepting its base language.
  try { Intl.getCanonicalLocales(code); } catch { return undefined; }
  return ISO_LANGUAGES[code.split("-")[0]];
}
export function samePvLanguage(a: unknown, b: unknown) {
  const code = pvLanguageCode(a);
  return !!code && code === pvLanguageCode(b);
}
