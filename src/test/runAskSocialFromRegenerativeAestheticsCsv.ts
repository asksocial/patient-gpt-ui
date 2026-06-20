import path from "path";
import { askSocial } from "../app/api/ask";
import { ingestMeltwaterCsv } from "../ingestion";

const CSV_PATH = path.resolve(__dirname, "../../data/regen-aesthetics.csv");

function getQuestionFromArgs(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error(
      'Please provide a question. Example:\n' +
        'npx ts-node --compiler-options \'{"module":"CommonJS"}\' src/test/runAskSocialFromRegenerativeAestheticsCsv.ts "What is driving growing interest in regenerative aesthetics?"'
    );
    process.exit(1);
  }

  return question;
}

function main() {
  const question = getQuestionFromArgs();

  console.log("📥 Loading Regenerative Aesthetics Meltwater CSV...");

  const rawCards = ingestMeltwaterCsv(CSV_PATH, {
    sourceType: "meltwater",
    therapeuticArea: "regenerative_aesthetics",
    profileId: "regenerative_aesthetics",
  });

  console.log(`Mapped ${rawCards.length} high-signal cards`);
  console.log(`🧠 Question: ${question}`);

  const result = askSocial(question, rawCards as any);

  console.log("\n================ ASK SOCIAL OUTPUT ================\n");
  console.log(JSON.stringify(result, null, 2));
}

main();