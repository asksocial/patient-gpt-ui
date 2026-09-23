import manifestJson from "../../../../../config/pv/training-corpus/botulinum-toxin/examples/manifest.json";
import templatesJson from "../../../../../config/pv/training-corpus/botulinum-toxin/examples/contrast-templates-2026.01.0.json";
import specialJson from "../../../../../config/pv/training-corpus/botulinum-toxin/examples/special-situations-2026.01.0.json";
import productsJson from "../../../../../config/pv/training-corpus/botulinum-toxin/regulatory/products-2026.01.0.json";
import { PV_EXAMPLE_CLASSES, type ContrastTemplate, type ExampleDatasetConfiguration, type SpecialSituation } from "./types";

const configuration = manifestJson as ExampleDatasetConfiguration;
const templates = templatesJson as unknown as { schemaVersion: string; templatesVersion: string; status: string; classes: ContrastTemplate[] };
const specialSituations = specialJson as unknown as { schemaVersion: string; specialSituationsVersion: string; status: string; situations: Array<{ id: SpecialSituation; meddra_pt: string; mentioned_event: string; text: string }> };
const productRegistry = productsJson as { registryVersion: string; status: string; families: Array<{ familyId: string; brands: string[]; activeIngredients: string[] }> };

function validateConfiguration() {
  if (configuration.status !== "draft_pending_human_adjudication" && configuration.status !== "active") throw new Error("Invalid PV example dataset status.");
  if (templates.status !== "active" || specialSituations.status !== "active" || productRegistry.status !== "active") throw new Error("PV example generation requires active versioned templates and product registry.");
  const expectedContextClasses = PV_EXAMPLE_CLASSES.filter((item) => item !== "MEDICATION_ERROR_OR_SPECIAL_SITUATION");
  if (templates.classes.length !== expectedContextClasses.length || new Set(templates.classes.map((item) => item.class)).size !== expectedContextClasses.length) throw new Error("Every contextual PV example class must have exactly one active template.");
  for (const item of expectedContextClasses) if (!templates.classes.some((template) => template.class === item)) throw new Error(`Missing contextual template ${item}.`);
  if (specialSituations.situations.length !== 11 || new Set(specialSituations.situations.map((item) => item.id)).size !== 11) throw new Error("All eleven configured special situations must be unique and present.");
  if (Object.values(configuration.splitPercentages).reduce((sum, value) => sum + value, 0) !== 100) throw new Error("Dataset split percentages must total 100.");
}

validateConfiguration();

export function getExampleDatasetConfiguration() { return configuration; }
export function getContrastTemplates() { return templates; }
export function getSpecialSituationTemplates() { return specialSituations; }
export function getTrainingProductRegistry() { return productRegistry; }
