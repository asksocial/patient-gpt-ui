/** Explicit source-market geography. Country membership is shared by queries,
 * source composition and retained evidence; missing metadata never implies a market. */
const REGION_CODES = {
  "East Asia": "CN HK MO TW JP KR KP MN",
  "Southeast Asia": "BN KH ID LA MY MM PH SG TH TL VN",
  "South Asia": "AF BD BT IN IR MV NP PK LK",
  "Central Asia": "KZ KG TJ TM UZ",
  "West Asia": "AM AZ BH CY GE IQ IL JO KW LB OM PS QA SA SY TR AE YE",
  "Europe": "AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
  "Africa": "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW RE YT SH EH",
  "Latin America & Caribbean": "AR BO BR CL CO EC GY PY PE SR UY VE BZ CR SV GT HN MX NI PA AG BS BB CU DM DO GD HT JM KN LC VC TT PR AW CW BQ SX GP MQ GF",
  "North America": "CA US MX GL BM",
  "Oceania": "AU NZ FJ KI MH FM NR PW PG WS SB TO TV VU NC PF GU AS MP CK NU TK WF PN",
} as const;
const codes = (key: keyof typeof REGION_CODES) => REGION_CODES[key].split(" ");
const asia = ["East Asia", "Southeast Asia", "South Asia", "Central Asia", "West Asia"].flatMap(key => codes(key as keyof typeof REGION_CODES));
const regions: Array<{ label: string; pattern: RegExp; codes: string[] }> = [
  { label: "Asia-Pacific", pattern: /\b(?:asia[\s-]*pacific|apac)\b/gi, codes: [...asia, ...codes("Oceania")] },
  { label: "Southeast Asia", pattern: /\b(?:south[\s-]*east(?:ern)?[\s-]*asia(?:n)?|asean)\b/gi, codes: codes("Southeast Asia") },
  { label: "East Asia", pattern: /\b(?:east(?:ern)?[\s-]*asia(?:n)?)\b/gi, codes: codes("East Asia") },
  { label: "South Asia", pattern: /\b(?:south(?:ern)?[\s-]*asia(?:n)?)\b/gi, codes: codes("South Asia") },
  { label: "Central Asia", pattern: /\bcentral[\s-]*asia(?:n)?\b/gi, codes: codes("Central Asia") },
  { label: "West Asia", pattern: /\bwest(?:ern)?[\s-]*asia(?:n)?\b/gi, codes: codes("West Asia") },
  { label: "Middle East & North Africa", pattern: /\b(?:middle east(?:ern)?(?:\s+and\s+north africa(?:n)?)?|mena)\b/gi, codes: [...codes("West Asia"), "DZ", "EG", "LY", "MA", "TN", "SD"] },
  { label: "Asia", pattern: /\basia(?:n)?\b/gi, codes: asia },
  { label: "Europe", pattern: /\beurope(?:an)?\b/gi, codes: codes("Europe") },
  { label: "Latin America & Caribbean", pattern: /\b(?:latin america(?:n)?(?:\s+and\s+(?:the\s+)?caribbean)?|latam|caribbean)\b/gi, codes: codes("Latin America & Caribbean") },
  { label: "North America", pattern: /\bnorth america(?:n)?\b/gi, codes: codes("North America") },
  { label: "Africa", pattern: /\bafrica(?:n)?\b/gi, codes: codes("Africa") },
  { label: "Oceania", pattern: /\b(?:oceania|australasia(?:n)?)\b/gi, codes: codes("Oceania") },
];
const names = new Intl.DisplayNames(["en"], { type: "region" });
const countryNames = new Map<string, string>();
// ISO country names let unsupported-in-this-corpus markets still produce an empty scope.
for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const code = a + b;
  if ("AN BU CS DD DY FX HV NH NT PC PU PZ RH SU TP UK VD WK YD YU ZR".split(" ").includes(code)) continue;
  const name = names.of(code);
  if (name && name !== code) countryNames.set(name.toLowerCase(), code);
}
const aliases: Record<string, string> = {
  "united states": "US", "united states of america": "US", usa: "US", "u.s.": "US", "u.s.a.": "US", american: "US",
  "united kingdom": "GB", uk: "GB", britain: "GB", british: "GB", "south korea": "KR", "republic of korea": "KR", "korea, republic of": "KR", korean: "KR",
  "north korea": "KP", vietnam: "VN", "viet nam": "VN", taiwan: "TW", "taiwan, province of china": "TW", "hong kong": "HK", "hong kong sar china": "HK", "macao": "MO", macau: "MO",
  china: "CN", chinese: "CN", "mainland china": "CN", japanese: "JP", indian: "IN", brazilian: "BR", canadian: "CA", australian: "AU", german: "DE", french: "FR", singaporean: "SG", indonesian: "ID", philippine: "PH", filipino: "PH", thai: "TH", malaysian: "MY", "uae": "AE", "united arab emirates": "AE", "russian federation": "RU", russia: "RU", "czech republic": "CZ", turkey: "TR", "türkiye": "TR",
};
for (const [name, code] of Object.entries(aliases)) countryNames.set(name, code);
const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function sourceCountryCode(value: unknown): string | undefined {
  const name = String(value || "").trim().toLowerCase();
  return countryNames.get(name) || (/^[a-z]{2}$/.test(name) ? name.toUpperCase() : undefined);
}
export function resolveQuestionGeography(question: string): { labels: string[]; remainder: string; matchesCountry: (value: unknown) => boolean } {
  let remainder = question;
  const selected = new Set<string>();
  const labels: string[] = [];
  for (const region of regions) {
    if (region.pattern.test(remainder)) {
      labels.push(region.label);
      region.codes.forEach(code => selected.add(code));
      remainder = remainder.replace(region.pattern, " ");
    }
    region.pattern.lastIndex = 0;
  }
  // Longest first avoids treating South Korea as a broader nested country name.
  for (const [name, code] of [...countryNames].sort((a, b) => b[0].length - a[0].length)) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "giu");
    if (!pattern.test(remainder)) continue;
    selected.add(code);
    labels.push(names.of(code) || name);
    remainder = remainder.replace(pattern, " ");
  }
  // "us" is usually a pronoun; uppercase US is an unambiguous country abbreviation.
  if (/\bUS\b/.test(remainder)) { selected.add("US"); labels.push("United States"); remainder = remainder.replace(/\bUS\b/g, " "); }
  return { labels: [...new Set(labels)], remainder, matchesCountry: value => selected.has(sourceCountryCode(value) || "") };
}
