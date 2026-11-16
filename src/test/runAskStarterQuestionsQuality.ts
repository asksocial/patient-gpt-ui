import assert from "node:assert/strict";
import { buildAskStarters } from "../config/askStarters";

assert.deepEqual(buildAskStarters(""), []);
const initial = buildAskStarters("GLP-1");
assert.equal(initial.length, 5, "No previous report means no report-comparison suggestion");
assert.ok(initial.every(item => item.id !== "shifted"));
const glp1 = buildAskStarters("GLP-1", { topMarkets: ["South Korea", "Japan"], hasPreviousReport: true });
assert.equal(glp1.length, 6);
assert.equal(glp1.find(item => item.id === "countries")?.question, "How do GLP-1 conversations differ between South Korea and Japan?");
assert.equal(glp1.find(item => item.id === "concerns")?.question, "How have concerns about side effects changed over time?");
const changed = buildAskStarters("Hepatitis B", { topMarkets: ["Brazil", "United States"] });
assert.ok(changed.every(item => !item.question.includes("GLP-1")), "Changing topic cannot reuse the previous topic's prompts");
assert.ok(changed.find(item => item.id === "countries")?.question.includes("Brazil and United States"));
assert.ok(buildAskStarters("Gene Therapy", { topMarkets: ["Japan", "Japan"] }).find(item => item.id === "countries")?.question.includes("across countries"), "A comparison requires two distinct markets");
assert.ok(buildAskStarters("New imported topic").every(item => !item.question.includes("{topic}")), "New topics receive resolved config defaults");
console.log("PASS topic-specific starters, actual country pairs, topic changes, report-gated comparisons and new-topic fallbacks");
