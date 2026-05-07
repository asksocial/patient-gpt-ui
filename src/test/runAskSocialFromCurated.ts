import { askSocial } from "../app/api/ask";
import { ingestCurated } from "../ingestion";

function getQuestionFromArgs(): string {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error(
      'Please provide a question. Example:\n' +
        'npx ts-node --compiler-options \'{"module":"CommonJS"}\' src/test/runAskSocialFromCurated.ts "What are the biggest unmet needs?"'
    );
    process.exit(1);
  }

  return question;
}

function main() {
  const question = getQuestionFromArgs();

  console.log("📥 Loading curated Hepatitis B data...");

  const rawCards = ingestCurated("hepatitis_b") as any[];

  console.log(`Mapped ${rawCards.length} curated cards`);
  console.log(`🧠 Question: ${question}`);

  const result = askSocial(question, rawCards);

  console.log("\n================ ASK SOCIAL CURATED OUTPUT ================\n");
  console.log(JSON.stringify(result, null, 2));
}

main();