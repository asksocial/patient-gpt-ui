import {
  ReportComposer,
  REPORT_TYPE_CATALOG,
  type ReportBlock,
} from "../lib/intelligence-platform";

const blockKinds =
  [
    "saved_search",
    "knowledge_graph_view",
    "agent_output",
    "signal_trend",
    "citations",
    "table",
    "chart",
    "executive_summary",
  ] as const;

const blocks: ReportBlock[] =
  blockKinds.map(
    (kind, index) => ({
      id: `block_${index + 1}`,
      kind,
      title: kind,
      content: {
        summary: `${kind} content`,
      },
      evidenceIds: ["evidence_1"],
    })
  );

const composer =
  new ReportComposer();
const report = composer.compose({
  id: "report_1",
  organizationId: "org_1",
  workspaceId: "workspace_1",
  moduleIds: [
    "medical_affairs",
    "clinical_trials",
  ],
  type: "scientific_landscape",
  title:
    "Scientific landscape",
  query:
    "What evidence changed this quarter?",
  sourceSet: [
    "literature",
    "trial_registry",
    "literature",
  ],
  agentVersions: [
    {
      agentId:
        "scientific_intelligence_advisor",
      version: "2.3.0",
    },
  ],
  blocks,
  citations: [
    {
      evidenceId:
        "evidence_1",
      sourceId: "source_1",
      title: "Source one",
      sourceType:
        "scientific_literature",
    },
  ],
  approvalHistory: [
    {
      actorId: "user_1",
      decision: "approved",
      occurredAt:
        "2026-07-30T13:00:00.000Z",
    },
  ],
  generatedAt:
    "2026-07-30T12:00:00.000Z",
  refreshSchedule: {
    cadence: "weekly",
    timezone:
      "America/New_York",
    nextRunAt:
      "2026-08-06T12:00:00.000Z",
    enabled: true,
  },
});

if (
  REPORT_TYPE_CATALOG.length !==
    8 ||
  report.blocks.length !== 8 ||
  new Set(
    report.blocks.map(
      (block) => block.kind
    )
  ).size !== 8
) {
  throw new Error(
    "The report composer must support all prescribed report types and content blocks."
  );
}

if (
  report.provenance.query !==
    report.query ||
  report.provenance
    .sourceSet.length !== 2 ||
  report.provenance
    .agentVersions[0]
    .version !== "2.3.0" ||
  report.provenance
    .approvalHistory[0]
    .decision !== "approved" ||
  report.provenance
    .generatedAt !==
    report.generatedAt
) {
  throw new Error(
    "Reports must retain their complete provenance and approval history."
  );
}

let rejectedUnknownEvidence =
  false;
try {
  composer.compose({
    ...report,
    id: "report_2",
    blocks: [
      {
        id: "bad_block",
        kind: "agent_output",
        title: "Invalid output",
        content: {},
        evidenceIds: [
          "missing_evidence",
        ],
      },
    ],
  });
} catch {
  rejectedUnknownEvidence =
    true;
}

if (!rejectedUnknownEvidence) {
  throw new Error(
    "Report blocks must not cite evidence outside the retained citation set."
  );
}

console.log(
  JSON.stringify(
    {
      reportTypes:
        REPORT_TYPE_CATALOG.map(
          (type) => type.id
        ),
      blockKinds:
        report.blocks.map(
          (block) => block.kind
        ),
      scheduledRefresh:
        report.refreshSchedule,
      provenance:
        report.provenance,
      rejectedUnknownEvidence,
    },
    null,
    2
  )
);
