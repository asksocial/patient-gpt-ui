import { assembleAnswer } from "../answering/assembleAnswer";
import { ingestCurated } from "../ingestion";

function main() {
  const rawCards = ingestCurated("hepatitis_b");

  const answer = assembleAnswer(rawCards as any);

  console.log("\n================ CURATED OUTPUT ================\n");
  console.log(JSON.stringify(answer, null, 2));
}

main();