import {
  EVALUATION_CHANGE_TRIGGERS,
  InMemoryMeasurementStore,
  METRIC_CATALOG,
  runEvaluationSuite,
} from "../lib/intelligence-platform";

const layerCounts =
  METRIC_CATALOG.reduce(
    (counts, metric) => {
      counts[metric.layer] += 1;
      return counts;
    },
    {
      platform: 0,
      module: 0,
      agent: 0,
    }
  );

if (
  layerCounts.platform !== 6 ||
  layerCounts.module !== 6 ||
  layerCounts.agent !== 7
) {
  throw new Error(
    "Measurement must cover every prescribed platform, module, and agent metric."
  );
}

const store =
  new InMemoryMeasurementStore();
store.record({
  id: "event_1",
  organizationId: "org_1",
  metricId:
    "citation_coverage",
  value: 0.8,
  occurredAt:
    "2026-07-30T14:00:00.000Z",
});
store.record({
  id: "event_2",
  organizationId: "org_1",
  metricId:
    "citation_coverage",
  value: 1,
  occurredAt:
    "2026-07-30T14:01:00.000Z",
});
store.record({
  id: "event_3",
  organizationId: "org_2",
  metricId:
    "citation_coverage",
  value: 0.1,
  occurredAt:
    "2026-07-30T14:02:00.000Z",
});

const summary = store.summarize({
  organizationId: "org_1",
  metricId:
    "citation_coverage",
});

if (
  summary.sampleCount !== 2 ||
  summary.value !== 0.9 ||
  store.list({
    organizationId: "org_1",
  }).length !== 2
) {
  throw new Error(
    "Measurement summaries must remain tenant-isolated and honor metric aggregation."
  );
}

const evaluation =
  runEvaluationSuite(
    {
      id: "suite_1",
      name:
        "Evidence quality gate",
      version: "1.0.0",
      thresholds: [
        {
          metricId:
            "citation_coverage",
          minimum: 0.95,
        },
        {
          metricId:
            "response_latency",
          maximum: 2500,
        },
      ],
    },
    {
      trigger: "prompt",
      scores: {
        citation_coverage:
          summary.value,
        response_latency: 1200,
      },
      completedAt:
        "2026-07-30T15:00:00.000Z",
    }
  );

if (
  evaluation.status !==
    "failed" ||
  EVALUATION_CHANGE_TRIGGERS.length !==
    5 ||
  evaluation.results.filter(
    (result) =>
      result.passed
  ).length !== 1
) {
  throw new Error(
    "Evaluation suites must gate every prescribed change category against explicit thresholds."
  );
}

console.log(
  JSON.stringify(
    {
      metricCount:
        METRIC_CATALOG.length,
      layerCounts,
      tenantSummary: summary,
      evaluationTriggers:
        EVALUATION_CHANGE_TRIGGERS,
      evaluation,
    },
    null,
    2
  )
);
