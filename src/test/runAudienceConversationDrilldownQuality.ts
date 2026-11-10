import assert from "node:assert/strict";
import { loadCanonicalFindingsForAsk } from "../lib/answers/loadCanonicalFindingsForAsk";
import { loadSearchCorpusIntelligence, loadAudienceConversationPosts } from "../lib/answers/loadSearchCorpusIntelligence";

const corpus = loadCanonicalFindingsForAsk("GLP-1");
assert.equal(corpus.status, "available");
for (const question of ["", "What are patients saying about their treatment experiences?", "What are people saying in Brazil?"]) {
  const summary = loadSearchCorpusIntelligence("GLP-1", corpus.findings, question);
  assert.equal(summary.evidenceContext!.question, question);
  for (const group of summary.clientGroups.filter(group => group.count)) {
    const types = new Map<string, number>();
    for (const subtype of group.subtypes) for (const item of subtype.conversations) types.set(item.id, (types.get(item.id) || 0) + item.count);
    // Each group's leading types must reconcile, including patient-related
    // records whose original source role was media, commercial or public.
    for (const [conversationType, count] of [...types].sort((a, b) => b[1] - a[1]).slice(0, 2)) {
      const options = { question, group: group.id, conversationType };
      const first = loadAudienceConversationPosts("GLP-1", corpus.findings, options);
      assert.equal(first.total, count, `${question}: ${group.id}/${conversationType}`);
      const ids = new Set<string>();
      for (let page = 1; page <= first.pages; page++) {
        const result = loadAudienceConversationPosts("GLP-1", corpus.findings, { ...options, page });
        assert.ok(result.items.length <= 20);
        for (const item of result.items) {
          assert.equal(item.conversationType, conversationType);
          if (question.includes("Brazil")) assert.equal(item.country, "Brazil");
          assert.ok(!ids.has(item.id), "No overlap between pages");
          ids.add(item.id);
        }
      }
      assert.equal(ids.size, count, "Pagination exposes the complete counted source cohort");
    }
    const subtype = group.subtypes.find(item => item.conversations.length)!;
    const item = subtype.conversations[0];
    const narrowed = loadAudienceConversationPosts("GLP-1", corpus.findings, { question, group: group.id, conversationType: item.id, role: subtype.id });
    assert.equal(narrowed.total, item.count, "Subtype link stays within the selected source role and client group");
    assert.ok(narrowed.items.every(record => record.audience === subtype.id));
  }
  if (summary.fullCorpus) assert.equal(summary.fullCorpus.evidenceContext!.question, "", "Overall corpus drill-down does not inherit the focused query");
}
const missing = loadAudienceConversationPosts("GLP-1", corpus.findings, { question: "xylophonebarnacle", group: "patients_circle", conversationType: "personal_experience", page: Infinity });
assert.equal(missing.total, 0);
assert.equal(missing.page, 1);
assert.deepEqual(missing.items, []);
console.log("PASS audience and conversation intersections, exact counts, full source pagination, query isolation, source-role narrowing and empty results");
