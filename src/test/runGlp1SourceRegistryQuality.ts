import assert from "node:assert/strict";
import { buildGlp1SourceRegistry, loadGlp1SourceRegistry } from "../lib/pv/sources/glp1Registry";

const registry = loadGlp1SourceRegistry();
assert.equal(registry.recordCount, 5000);
assert.equal(registry.sourceCount, 1353);
assert.equal(registry.unattributedCount, 0);
assert.equal(registry.sources.reduce((sum, source) => sum + source.mentionCount, 0), registry.recordCount);
assert.equal(new Set(registry.sources.map(source => source.domain)).size, registry.sourceCount);
assert.equal(registry.sources.find(source => source.domain === "x.com")?.mentionCount, 1368);
assert.equal(registry.sources.find(source => source.domain === "dcinside.com")?.mentionCount, 430);
for (const source of registry.sources) {
  for (const values of [source.sourceTypes, source.markets, source.languages, source.sourceNames]) {
    assert.ok(values.length);
    assert.equal(values.reduce((sum, value) => sum + value.count, 0), source.mentionCount);
  }
  assert.equal(source.monitoringStatus, "not_configured");
  assert.ok(source.exampleUrls.every(url => /^https?:\/\//.test(url)));
}
assert.ok(registry.sources.some(source => source.sourceTypes.some(type => type.value === "print")));
assert.ok(registry.sources.some(source => source.languages.some(language => language.value === "Korean")));
const fixture = buildGlp1SourceRegistry([
  { "Source Domain": "www.example.com", "Source Name": "Example", URL: "https://news.example.com/story", Country: "Japan", Language: "Japanese", "Source Type": "online news", Date: "2026-01-02" },
  { URL: "https://example.com/story-2", "Source Type": "comments", Date: "2026-01-01" },
  { "Source Domain": "", URL: "javascript:alert(1)" },
], "fixture");
assert.equal(fixture.sourceCount, 1);
assert.equal(fixture.unattributedCount, 1);
assert.equal(fixture.sources[0].mentionCount, 2);
assert.deepEqual(fixture.sources[0].markets, [{value:"Japan",count:1},{value:"Unspecified",count:1}]);
assert.equal(fixture.sources[0].firstMentionDate, "2026-01-01");
assert.equal(fixture.sources[0].lastMentionDate, "2026-01-02");
console.log("PASS GLP-1 registry: 1,353 source domains reconcile to 5,000 mentions, multilingual/full-corpus coverage, domain normalization, missing attribution and safe provenance URLs");
