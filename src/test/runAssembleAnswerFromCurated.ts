import { assembleAnswer } from "../answering/assembleAnswer";
import { ingestCurated } from "../ingestion";

const curatedCards = [
  {
    id: "curated-1",
    summary: "Patients frequently describe pain and fatigue as the most disruptive day-to-day burdens.",
    country: "United States",
    persona: "patient",
    symptoms: ["pain", "fatigue"],
    labels: ["symptom", "quality of life"],
    score: 0.9,
  },
  {
    id: "curated-2",
    summary: "Caregivers often describe jaundice as a visible and alarming sign that triggers concern.",
    country: "United Kingdom",
    persona: "caregiver",
    symptoms: ["jaundice"],
    labels: ["symptom"],
    score: 0.8,
  },
];

function main() {
  const rawCards = ingestCurated(curatedCards, {
    sourceType: "curated",
    therapeuticArea: "hepatitis_b",
  });

const answer = assembleAnswer(rawCards, "treatment_decision_drivers");

  console.log("\n================ CURATED OUTPUT ================\n");
  console.log(JSON.stringify(answer, null, 2));
}

main();