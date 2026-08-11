import {
  getTherapeuticAreaCoverage,
  listTherapeuticAreaCoverage,
} from "../lib/analytics/coverage";
import {
  getKnowledgePersistenceMode,
  getKnowledgePersistenceStatus,
  knowledgePersistenceDisabledResponse,
} from "../lib/knowledge/mode";

if (
  getKnowledgePersistenceMode() !==
    "stateless" ||
  getKnowledgePersistenceStatus()
    .enabled
) {
  throw new Error(
    "Knowledge persistence must default safely to stateless mode."
  );
}

const disabled =
  knowledgePersistenceDisabledResponse();

if (
  disabled.code !==
    "KNOWLEDGE_PERSISTENCE_DISABLED"
) {
  throw new Error(
    "Stateless endpoints must expose a stable machine-readable error code."
  );
}

const coverage =
  listTherapeuticAreaCoverage();
const validated = coverage.filter(
  (item) =>
    item.status === "validated"
);
const conversationOnly =
  coverage.filter(
    (item) =>
      item.status ===
      "conversation_only"
  );

if (
  coverage.length !== 6 ||
  validated.length !== 5 ||
  conversationOnly.length !== 1
) {
  throw new Error(
    "The production coverage registry must explicitly classify all six active therapeutic areas."
  );
}

if (
  getTherapeuticAreaCoverage(
    "Unknown Area"
  ).status !== "conversation_only"
) {
  throw new Error(
    "Unknown therapeutic areas must fail closed to conversation-only coverage."
  );
}

console.log(
  JSON.stringify(
    {
      knowledgeMode:
        getKnowledgePersistenceMode(),
      validated:
        validated.map(
          (item) =>
            item.therapeuticArea
        ),
      conversationOnly:
        conversationOnly.map(
          (item) => ({
            therapeuticArea:
              item.therapeuticArea,
            reason: item.reason,
          })
        ),
    },
    null,
    2
  )
);
