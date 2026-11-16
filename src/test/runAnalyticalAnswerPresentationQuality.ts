import assert from "node:assert/strict";
import { splitAnalyticalAnswer } from "../lib/answers/analyticalAnswerPresentation";
const finding = "The available conversations highlight nutrition and treatment routines. These accounts can help focus further research into daily experiences.";
const caveat = "The findings reflect the available conversations; further research is needed to establish how common these experiences are.";
assert.deepEqual(splitAnalyticalAnswer(`${finding} ${caveat}`), { main: finding, caveats: caveat });
assert.deepEqual(splitAnalyticalAnswer("A 24.3% theme share describes matching records."), { main: "A 24.3% theme share describes matching records.", caveats: "" });
assert.deepEqual(splitAnalyticalAnswer(""), { main: "", caveats: "" });
assert.equal(splitAnalyticalAnswer("These accounts do not establish prevalence.").main, "");
console.log("PASS findings retain their main paragraph, caveats separate, and decimal percentages remain intact");
