import {
  composeHybridAnswer,
} from "../lib/answers/composeHybridAnswer";

async function main() {
  const answer =
    await composeHybridAnswer({
      question:
        "What are people saying right now?",
      therapeuticArea:
        "Unloaded Test Area",
      curatedThemes: [],
      liveThemes: [],
      matches: [],
      curatedInsights: [],
    });

  if (
    !answer.directAnswer.includes(
      "cannot provide a source-grounded answer"
    ) ||
    answer.curatedIntelligence
      .themes.length !== 0 ||
    answer.liveData.themes
      .length !== 0 ||
    answer.liveData
      .emergingNarratives.length !==
      0
  ) {
    throw new Error(
      "The no-evidence guard did not fail closed."
    );
  }

  console.log(
    JSON.stringify(
      {
        directAnswer:
          answer.directAnswer,
        curatedThemeCount:
          answer
            .curatedIntelligence
            .themes.length,
        liveThemeCount:
          answer.liveData
            .themes.length,
        recommendationCount:
          answer
            .recommendedActions
            .length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
