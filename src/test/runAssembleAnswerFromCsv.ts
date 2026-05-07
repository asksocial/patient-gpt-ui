import path from "path";
import { assembleAnswer } from "../answering/assembleAnswer";
import { ingestMeltwaterCsv } from "../ingestion";

const CSV_PATH = path.resolve(
  __dirname,
  "../../data/HepB_-_Patients__Caregivers - Mar 11, 2026 - 11 47 15 AM.csv"
);

const QUESTION_INTENT = "symptom_qol_burden";

function main() {
  console.log("📥 Loading Meltwater CSV...");

  const rawCards = ingestMeltwaterCsv(CSV_PATH, {
    sourceType: "meltwater",
    therapeuticArea: "hepatitis_b",
  });

  console.log(`Mapped ${rawCards.length} high-signal cards`);

  const answer = assembleAnswer(rawCards, QUESTION_INTENT);

  console.log("\n================ OUTPUT ================\n");
  console.log(JSON.stringify(answer, null, 2));
}

main();