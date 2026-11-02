import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { matchesGlp1ModuleSection, isExplicitPromotion } from "../lib/intelligence/glp1ModuleRelevance";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { buildModuleIntelligence, buildModuleEvidenceCatalog, selectModuleAnalysisFindings } from "../lib/module-intelligence/buildModuleIntelligence";
import { sourceContext } from "../lib/intelligence/sourceContext";

const negativeCases = [
  ["policy_awareness", "QT @JasonBedrick: Gutting the @usedgov without legislation is like taking a daily GLP-1 pill without working out. It’s great as long as you ..."],
  ["reputation", "The controversy over the election is like using Ozempic."],
  ["policy_awareness", "Vou trazer tirzepatide escondida da policia federal."],
  ["policy_awareness", "My doctor got me approved for Zepbound."],
  ["community_priorities", "Our pharmacy is augmenting the patient experience for patients taking GLP-1 drugs."],
  ["access_equity", "Semaglutide revenue grew despite intense price competition."],
  ["reputation", "Thank you to everyone who trusted us for fresh GLP-1-friendly meals."],
  ["reputation", "A food report covers nutrition curiosity, purchasing drivers, GLP-1 behavioral impact and label trust."],
  ["reputation", "GLP-1 medications, nourishment and muscle health. Shifting away from body criticism."],
  ["reputation", "QT @livedoornews: #反逆のマンジャロ・ラーメン ; 【批判噴出】本人でないと解約できない NHK受信料トラブル"],
  ["access_equity", "#CeraVePartner Crepey skin and GLP-1s? CeraVe created lotion with GLP-1 patients in mind. Hydrate and support the skin barrier! #GLP1"],
  ["reputation", "A critical side effect associated with GLP-1 medications."],
  ["narratives", "A critical aesthetic consideration for patients on GLP-1 therapies."],
  ["organizations", "Pritzker is on Ozempic for his election campaign."],
  ["policy_awareness", "I found information explaining my Mounjaro dose."],
  ["access_equity", "As the price of goods continues to skyrocket and semaglutide becomes mainstream, this pizza will take off."],
  ["reputation", "I take Mounjaro. NHK television fees prompted criticism."],
] as const;
const positiveCases = [
  ["policy_awareness", "The new FDA policy regulates GLP-1 prescribing. Some call it like taking a daily GLP-1 pill."],
  ["reputation", "Patients distrust the company marketing Ozempic."],
  ["narratives", "The debate over stigma associated with Ozempic continues."],
  ["advocacy", "A patient advocacy group discussed GLP-1 access."],
  ["access_equity", "Mounjaro insurance coverage was denied and I cannot afford it."],
  ["access_equity", "マウンジャロではなくマンジャロの保険費用と価格について。"],
  ["access_equity", "마운자로 가격이 비싸고 보험 비용이 부담입니다."],
  ["access_equity", "O preço do Mounjaro limita acesso ao tratamento."],
  ["policy_awareness", "Anvisa aprovou novos medicamentos de semaglutida."],
  ["access_equity", "I take Wegovy. Its cost is unaffordable."],
] as const;
for (const [section, text] of negativeCases) assert.equal(matchesGlp1ModuleSection(section, text), false, text);
for (const [section, text] of positiveCases) assert.equal(matchesGlp1ModuleSection(section, text), true, text);
assert(isExplicitPromotion("#CeraVePartner GLP-1 skin care"));
assert(isExplicitPromotion("Our prices: Tirzepatide for $60/month; we’ll sell retatrutide later."));

const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
const findings = corpus.findings;
const nhk = findings.filter(f => /NHK/.test(sourceContext(f)) && /受信料/.test(sourceContext(f)));
const cerave = findings.filter(f => /CeraVePartner/i.test(sourceContext(f)));
assert(nhk.length > 0 && cerave.length > 0, "Exercise the actual QA source records, not just synthetic copies.");
const report = [];
for (const moduleId of ["corporate_affairs", "advocacy"] as const) {
  const result = buildModuleIntelligence(moduleId, "GLP-1", findings);
  const subset = selectModuleAnalysisFindings(moduleId, findings);
  assert.equal(subset.length, result.dataQuality.selectedFindingCount);
  const analysis = buildModuleEvidenceCatalog(moduleId, "GLP-1", findings, { analysisOnly: true });
  assert.equal(analysis.total, subset.length);
  for (const section of result.sections) {
    const catalog = buildModuleEvidenceCatalog(moduleId, "GLP-1", findings, { analysisOnly: true, sectionId: section.id, pageSize: 50 });
    assert.equal(catalog.total, section.findingCount);
    assert(["directional", "insufficient"].includes(section.confidence));
  }
  for (const relevancePolicy of ["standard", "prequalified"] as const) {
    const checked = buildModuleIntelligence(moduleId, "GLP-1", [...nhk, ...cerave], undefined, { relevancePolicy });
    assert.equal(checked.sections.find(s => s.id === "reputation")?.findingCount || 0, 0);
    assert.equal(checked.sections.find(s => s.id === "access_equity")?.findingCount || 0, 0);
    if (moduleId === "advocacy") assert.equal(checked.dataQuality.selectedFindingCount, 0, "Sponsored source copy cannot establish independent advocacy evidence.");
    assert.equal(selectModuleAnalysisFindings(moduleId, [...nhk, ...cerave], { relevancePolicy }).length, checked.dataQuality.selectedFindingCount);
    assert.equal(buildModuleEvidenceCatalog(moduleId, "GLP-1", [...nhk, ...cerave], { analysisOnly: true }, { relevancePolicy }).total, checked.dataQuality.selectedFindingCount);
  }
  assert.equal(buildModuleEvidenceCatalog(moduleId, "GLP-1", findings).total, findings.length, "All original records remain available for source review.");
  report.push({ moduleId, retainedCorpus: findings.length, analyzed: subset.length, sections: result.sections.map(s => ({ id: s.id, count: s.findingCount })), representativeSources: result.evidence });
}
const output = path.join(process.cwd(), "artifacts/qa/glp1-module-relevance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "regression-results.json"), JSON.stringify({ status: "Pass", negativeCases: negativeCases.length, positiveCases: positiveCases.length, nhkSourceCount: nhk.length, sponsoredCeraveSourceCount: cerave.length, report }, null, 2));
console.log(JSON.stringify({ status: "Pass", modules: report.map(({ representativeSources: _sources, ...counts }) => counts) }, null, 2));
