import type {
  Citation,
} from "./evidence";
import type {
  AiAgentId,
  IntelligenceModuleId,
} from "./ids";

export const REPORT_TYPE_CATALOG = [
  {
    id: "scientific_landscape",
    name: "Scientific landscape",
  },
  {
    id: "trial_landscape",
    name: "Trial landscape",
  },
  {
    id: "patient_journey",
    name: "Patient journey",
  },
  {
    id: "congress_intelligence",
    name: "Congress intelligence",
  },
  {
    id: "competitive_briefing",
    name: "Competitive briefing",
  },
  {
    id: "reputation_briefing",
    name: "Reputation briefing",
  },
  {
    id: "advocacy_landscape",
    name: "Advocacy landscape",
  },
  {
    id: "safety_signal_review",
    name: "Safety-signal review",
  },
] as const;

export type ReportTypeId =
  (typeof REPORT_TYPE_CATALOG)[number]["id"];

export type ReportBlockKind =
  | "saved_search"
  | "knowledge_graph_view"
  | "agent_output"
  | "signal_trend"
  | "citations"
  | "table"
  | "chart"
  | "executive_summary";

export type ReportBlock = {
  id: string;
  kind: ReportBlockKind;
  title: string;
  content: unknown;
  evidenceIds?: string[];
};

export type ReportAgentVersion = {
  agentId: AiAgentId;
  version: string;
};

export type ReportApprovalEvent = {
  actorId: string;
  decision:
    | "requested"
    | "approved"
    | "changes_requested"
    | "rejected";
  occurredAt: string;
  note?: string;
};

export type ReportRefreshSchedule = {
  cadence:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly";
  timezone: string;
  nextRunAt: string;
  enabled: boolean;
};

export type ReportComposerInput = {
  id: string;
  organizationId: string;
  workspaceId: string;
  moduleIds: IntelligenceModuleId[];
  type: ReportTypeId;
  title: string;
  query: string;
  sourceSet: string[];
  agentVersions: ReportAgentVersion[];
  blocks: ReportBlock[];
  citations: Citation[];
  approvalHistory: ReportApprovalEvent[];
  generatedAt: string;
  refreshSchedule?: ReportRefreshSchedule;
};

export type ComposedIntelligenceReport =
  ReportComposerInput & {
    provenance: {
      query: string;
      sourceSet: string[];
      agentVersions:
        ReportAgentVersion[];
      generatedAt: string;
      approvalHistory:
        ReportApprovalEvent[];
    };
  };

function assertTimestamp(
  value: string,
  field: string
) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(
      `${field} must be an ISO timestamp.`
    );
  }
}

export class ReportComposer {
  compose(
    input: ReportComposerInput
  ): ComposedIntelligenceReport {
    if (
      !REPORT_TYPE_CATALOG.some(
        (type) =>
          type.id === input.type
      )
    ) {
      throw new Error(
        `Unknown report type: ${input.type}`
      );
    }
    if (!input.query.trim()) {
      throw new Error(
        "Report query is required."
      );
    }
    if (!input.sourceSet.length) {
      throw new Error(
        "Report source set is required."
      );
    }
    if (!input.agentVersions.length) {
      throw new Error(
        "At least one agent version is required."
      );
    }
    if (!input.blocks.length) {
      throw new Error(
        "At least one report block is required."
      );
    }

    assertTimestamp(
      input.generatedAt,
      "generatedAt"
    );
    input.approvalHistory.forEach(
      (event, index) =>
        assertTimestamp(
          event.occurredAt,
          `approvalHistory.${index}.occurredAt`
        )
    );
    if (input.refreshSchedule) {
      assertTimestamp(
        input.refreshSchedule
          .nextRunAt,
        "refreshSchedule.nextRunAt"
      );
    }

    const evidenceIds = new Set(
      input.citations.map(
        (citation) =>
          citation.evidenceId
      )
    );
    input.blocks.forEach(
      (block, index) => {
        for (const evidenceId of
          block.evidenceIds ?? []) {
          if (
            !evidenceIds.has(
              evidenceId
            )
          ) {
            throw new Error(
              `blocks.${index}.evidenceIds: Unknown evidence ID: ${evidenceId}`
            );
          }
        }
      }
    );

    const sourceSet = [
      ...new Set(input.sourceSet),
    ];
    const agentVersions =
      input.agentVersions.map(
        (entry) => ({
          ...entry,
        })
      );
    const approvalHistory =
      input.approvalHistory.map(
        (entry) => ({
          ...entry,
        })
      );

    return {
      ...input,
      sourceSet,
      agentVersions,
      approvalHistory,
      blocks: input.blocks.map(
        (block) => ({
          ...block,
          evidenceIds:
            block.evidenceIds
              ? [
                  ...block.evidenceIds,
                ]
              : undefined,
        })
      ),
      citations:
        input.citations.map(
          (citation) => ({
            ...citation,
          })
        ),
      provenance: {
        query: input.query,
        sourceSet: [
          ...sourceSet,
        ],
        agentVersions:
          agentVersions.map(
            (entry) => ({
              ...entry,
            })
          ),
        generatedAt:
          input.generatedAt,
        approvalHistory:
          approvalHistory.map(
            (entry) => ({
              ...entry,
            })
          ),
      },
    };
  }
}
