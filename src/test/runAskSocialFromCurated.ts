import fs from "fs";
import path from "path";
import { askSocial } from "../app/api/ask";
import { ingestCurated } from "../ingestion";

const CURATED_JSON_PATH = path.resolve(
  __dirname,
  "../../data/curated_intelligence.json"
);

function getQuestionFromArgs(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error(
      'Please provide a question. Example:\n' +
        'npx ts-node --compiler-options \'{"module":"CommonJS"}\' src/test/runAskSocialFromCurated.ts "What symptoms impact quality of life the most?"'
    );
    process.exit(1);
  }

  return question;
}

function loadCuratedJson(): any[] {
  if (!fs.existsSync(CURATED_JSON_PATH)) {
    console.error(
      `Curated input file not found at:\n${CURATED_JSON_PATH}\n\n` +
        "Create a JSON array at data/curated_intelligence.json using your ingested curated intelligence."
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(CURATED_JSON_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    console.error("data/curated_intelligence.json must contain a JSON array.");
    process.exit(1);
  }

  return parsed;
}

function main() {
  const question = getQuestionFromArgs();
  const curatedCards = loadCuratedJson();

  console.log("📥 Loading curated intelligence...");
  console.log(`Loaded ${curatedCards.length} curated cards`);
  console.log(`🧠 Question: ${question}`);

  const rawCards = ingestCurated(curatedCards, {
    sourceType: "curated",
    therapeuticArea: "hepatitis_b",
  });

  const result = askSocial(question, rawCards);

  console.log("\n================ ASK SOCIAL OUTPUT ================\n");
  console.log(JSON.stringify(result, null, 2));
}

main();