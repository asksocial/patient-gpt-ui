import { assembleAnswer } from "../answering/assembleAnswer";

const rawCards = [
  {
    id: "1",
    summary: "Women report pain and heavy bleeding impacting daily life",
    country: "Germany",
    persona: "symptomatic",
    symptoms: ["pain", "heavy bleeding"],
    labels: ["symptom", "quality of life"],
    score: 0.9,
  },
  {
    id: "2",
    summary: "Fertility concerns are a major emotional burden",
    country: "Spain",
    persona: "fertility fears",
    symptoms: ["fertility concerns"],
    labels: ["symptom"],
    score: 0.85,
  },
  {
    id: "3",
    summary: "Women express uncertainty about pregnancy outcomes",
    country: "Poland",
    persona: "pregnancy fears",
    symptoms: ["pregnancy concern"],
    labels: ["symptom"],
    score: 0.8,
  },
];

const result = assembleAnswer(rawCards as any);

console.log(JSON.stringify(result, null, 2));