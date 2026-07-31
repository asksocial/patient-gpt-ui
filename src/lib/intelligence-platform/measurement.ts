import type {
  AiAgentId,
  IntelligenceModuleId,
  WorkflowId,
} from "./ids";

export type MeasurementLayer =
  | "platform"
  | "module"
  | "agent";

export type MetricAggregation =
  | "sum"
  | "average";

export type MetricDefinition = {
  id: string;
  name: string;
  layer: MeasurementLayer;
  unit:
    | "count"
    | "ratio"
    | "milliseconds"
    | "currency"
    | "minutes"
    | "score";
  aggregation:
    MetricAggregation;
};

export const METRIC_CATALOG = [
  {
    id: "search_success",
    name: "Search success",
    layer: "platform",
    unit: "ratio",
    aggregation: "average",
  },
  {
    id: "citation_coverage",
    name: "Citation coverage",
    layer: "platform",
    unit: "ratio",
    aggregation: "average",
  },
  {
    id: "retrieval_accuracy",
    name: "Retrieval accuracy",
    layer: "platform",
    unit: "score",
    aggregation: "average",
  },
  {
    id: "response_latency",
    name: "Response latency",
    layer: "platform",
    unit: "milliseconds",
    aggregation: "average",
  },
  {
    id: "cost_per_workflow",
    name: "Cost per workflow",
    layer: "platform",
    unit: "currency",
    aggregation: "average",
  },
  {
    id:
      "security_policy_violations",
    name:
      "Security and policy violations",
    layer: "platform",
    unit: "count",
    aggregation: "sum",
  },
  {
    id: "active_users",
    name: "Active users",
    layer: "module",
    unit: "count",
    aggregation: "sum",
  },
  {
    id: "signals_reviewed",
    name: "Signals reviewed",
    layer: "module",
    unit: "count",
    aggregation: "sum",
  },
  {
    id: "reports_created",
    name: "Reports created",
    layer: "module",
    unit: "count",
    aggregation: "sum",
  },
  {
    id: "time_saved",
    name: "Time saved",
    layer: "module",
    unit: "minutes",
    aggregation: "sum",
  },
  {
    id: "decisions_supported",
    name: "Decisions supported",
    layer: "module",
    unit: "count",
    aggregation: "sum",
  },
  {
    id: "cross_module_adoption",
    name: "Cross-module adoption",
    layer: "module",
    unit: "ratio",
    aggregation: "average",
  },
  {
    id:
      "workflow_completion_rate",
    name:
      "Workflow completion rate",
    layer: "agent",
    unit: "ratio",
    aggregation: "average",
  },
  {
    id: "human_correction_rate",
    name: "Human correction rate",
    layer: "agent",
    unit: "ratio",
    aggregation: "average",
  },
  {
    id: "evidence_accuracy",
    name: "Evidence accuracy",
    layer: "agent",
    unit: "score",
    aggregation: "average",
  },
  {
    id: "approval_rate",
    name: "Approval rate",
    layer: "agent",
    unit: "ratio",
    aggregation: "average",
  },
  {
    id: "escalation_accuracy",
    name: "Escalation accuracy",
    layer: "agent",
    unit: "score",
    aggregation: "average",
  },
  {
    id: "user_satisfaction",
    name: "User satisfaction",
    layer: "agent",
    unit: "score",
    aggregation: "average",
  },
  {
    id: "domain_benchmark_score",
    name:
      "Domain-specific benchmark score",
    layer: "agent",
    unit: "score",
    aggregation: "average",
  },
] as const satisfies readonly MetricDefinition[];

export type MetricId =
  (typeof METRIC_CATALOG)[number]["id"];

export type MeasurementEvent = {
  id: string;
  organizationId: string;
  metricId: MetricId;
  value: number;
  occurredAt: string;
  moduleId?:
    IntelligenceModuleId;
  agentId?: AiAgentId;
  workflowId?: WorkflowId;
};

export type MetricSummary = {
  metricId: MetricId;
  value: number;
  sampleCount: number;
};

export class InMemoryMeasurementStore {
  private readonly events:
    MeasurementEvent[] = [];

  record(
    event: MeasurementEvent
  ) {
    const metric =
      METRIC_CATALOG.find(
        (candidate) =>
          candidate.id ===
          event.metricId
      );
    if (!metric) {
      throw new Error(
        `Unknown metric: ${event.metricId}`
      );
    }
    if (
      !Number.isFinite(
        event.value
      )
    ) {
      throw new Error(
        "Metric value must be finite."
      );
    }
    if (
      Number.isNaN(
        Date.parse(
          event.occurredAt
        )
      )
    ) {
      throw new Error(
        "occurredAt must be an ISO timestamp."
      );
    }
    if (
      metric.layer ===
        "module" &&
      !event.moduleId
    ) {
      throw new Error(
        `${event.metricId} requires moduleId.`
      );
    }
    if (
      metric.layer ===
        "agent" &&
      !event.agentId
    ) {
      throw new Error(
        `${event.metricId} requires agentId.`
      );
    }

    const stored = Object.freeze({
      ...event,
    });
    this.events.push(stored);
    return stored;
  }

  list(params: {
    organizationId: string;
    moduleId?:
      IntelligenceModuleId;
    agentId?: AiAgentId;
  }) {
    return this.events.filter(
      (event) =>
        event.organizationId ===
          params.organizationId &&
        (!params.moduleId ||
          event.moduleId ===
            params.moduleId) &&
        (!params.agentId ||
          event.agentId ===
            params.agentId)
    );
  }

  summarize(params: {
    organizationId: string;
    metricId: MetricId;
    moduleId?:
      IntelligenceModuleId;
    agentId?: AiAgentId;
  }): MetricSummary {
    const metric =
      METRIC_CATALOG.find(
        (candidate) =>
          candidate.id ===
          params.metricId
      )!;
    const events = this.list(
      params
    ).filter(
      (event) =>
        event.metricId ===
        params.metricId
    );
    const total = events.reduce(
      (sum, event) =>
        sum + event.value,
      0
    );
    return {
      metricId:
        params.metricId,
      value:
        metric.aggregation ===
          "average" &&
        events.length
          ? total /
            events.length
          : total,
      sampleCount: events.length,
    };
  }
}

export const EVALUATION_CHANGE_TRIGGERS =
  [
    "model",
    "prompt",
    "retrieval",
    "ontology",
    "source_processing",
  ] as const;

export type EvaluationChangeTrigger =
  (typeof EVALUATION_CHANGE_TRIGGERS)[number];

export type EvaluationThreshold = {
  metricId: MetricId;
  minimum?: number;
  maximum?: number;
};

export type EvaluationSuite = {
  id: string;
  name: string;
  version: string;
  thresholds:
    EvaluationThreshold[];
};

export type EvaluationRun = {
  suiteId: string;
  suiteVersion: string;
  trigger:
    EvaluationChangeTrigger;
  status: "passed" | "failed";
  results: Array<
    EvaluationThreshold & {
      value: number;
      passed: boolean;
    }
  >;
  completedAt: string;
};

export function runEvaluationSuite(
  suite: EvaluationSuite,
  params: {
    trigger:
      EvaluationChangeTrigger;
    scores: Partial<
      Record<
        MetricId,
        number
      >
    >;
    completedAt: string;
  }
): EvaluationRun {
  if (
    Number.isNaN(
      Date.parse(
        params.completedAt
      )
    )
  ) {
    throw new Error(
      "completedAt must be an ISO timestamp."
    );
  }
  const results =
    suite.thresholds.map(
      (threshold) => {
        const value =
          params.scores[
            threshold.metricId
          ];
        if (
          typeof value !==
          "number"
        ) {
          throw new Error(
            `Missing evaluation score: ${threshold.metricId}`
          );
        }
        return {
          ...threshold,
          value,
          passed:
            (threshold.minimum ===
              undefined ||
              value >=
                threshold.minimum) &&
            (threshold.maximum ===
              undefined ||
              value <=
                threshold.maximum),
        };
      }
    );
  return {
    suiteId: suite.id,
    suiteVersion:
      suite.version,
    trigger: params.trigger,
    status: results.every(
      (result) =>
        result.passed
    )
      ? "passed"
      : "failed",
    results,
    completedAt:
      params.completedAt,
  };
}
