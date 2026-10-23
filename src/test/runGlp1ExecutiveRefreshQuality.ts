import assert from "node:assert/strict";
import { loadCurrentGlp1ExecutiveIntelligence } from "../lib/answers/loadCurrentGlp1ExecutiveIntelligence";
import { refreshSearchCorpusIntelligence } from "../lib/answers/refreshSearchCorpusIntelligence";

const current = loadCurrentGlp1ExecutiveIntelligence("GLP-1")!;
assert.equal(current.executiveIntelligence.dataQuality.datasetFindingCount, 4737);
assert.equal(current.themeSummary.length, 8);
assert(current.executiveIntelligence.dataQuality.warnings.some(warning => warning.includes("5,000 source records")));
assert.equal(loadCurrentGlp1ExecutiveIntelligence("Botulinum toxin"), null);
const saved = { analyticalAnswer: { sections: [] }, executiveIntelligence: { therapeuticArea: "GLP-1", headline: "Stale brief" } };
const refreshed: any = refreshSearchCorpusIntelligence(saved, "GLP-1");
assert.notEqual(refreshed.executiveIntelligence.headline, "Stale brief");
assert.equal(refreshed.knowledgeSnapshot.snapshotKey, current.knowledgeSnapshot.snapshotKey);
assert.equal(saved.executiveIntelligence.headline, "Stale brief", "Refreshing must not mutate saved content.");
current.executiveIntelligence.dataQuality.warnings.push("mutation probe");
assert(!loadCurrentGlp1ExecutiveIntelligence("GLP-1")!.executiveIntelligence.dataQuality.warnings.includes("mutation probe"));
console.log("GLP-1 executive refresh: current corpus, topic isolation, snapshot alignment, and saved-content preservation passed.");
