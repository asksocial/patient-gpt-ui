import path from "path";
import { askSocial } from "../app/api/ask";
import { ingestMeltwaterCsv } from "../ingestion";

const CSV_PATH = path.resolve(
  __dirname,
  "../../data/HepB_-_Patients__Caregivers - Mar 11, 2026 - 11 47 15 AM.csv"
);

function getQuestionFromArgs(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error(
      'Please provide a question. Example:\n' +
        'npx ts-node --compiler-options \'{"module":"CommonJS"}\' src/test/runAskSocialFromCsv.ts "What symptoms have the biggest day-to-day impact?"'
    );
    process.exit(1);
  }

  return question;
}

function main() {
  const question = getQuestionFromArgs();

  console.log("📥 Loading Meltwater CSV...");

  const rawCards = ingestMeltwaterCsv(CSV_PATH, {
    sourceType: "meltwater",
    therapeuticArea: "hepatitis_b",
    profileId: "hepatitis_b",
  });

  console.log(`Mapped ${rawCards.length} high-signal cards`);
  console.log(`🧠 Question: ${question}`);

  const result = askSocial(question, rawCards);

  console.log("\n================ ASK SOCIAL OUTPUT ================\n");
  console.log(JSON.stringify(result, null, 2));
}

main();