import {
  AiGateway,
  InMemoryAiAuditSink,
  type AiProvider,
} from "../lib/ai-gateway";
import {
  AgentExecutionEngine,
  AGENT_EXECUTION_PROFILES,
  AGENT_LIFECYCLE,
} from "../lib/intelligence-platform";

async function run() {
  const provider: AiProvider = {
    async generate() {
      return {
        text: JSON.stringify({
          answer:
            "The evidence indicates a defined scientific communication need.",
          claims: [
            {
              text:
                "A scientific communication need is present.",
              confidence: 0.82,
              evidenceIds: [
                "evidence_1",
              ],
            },
          ],
          citations: [
            {
              evidenceId:
                "evidence_1",
              sourceId:
                "source_1",
              title:
                "Scientific source",
              sourceType:
                "scientific_literature",
              excerpt: null,
              url: null,
              publishedAt: null,
            },
          ],
          limitations: [
            "Limited to approved sources.",
          ],
          generatedAt:
            "2026-07-30T12:00:00.000Z",
          statements: [
            {
              kind:
                "ai_inference",
              text:
                "A communication response may be useful.",
              confidence: 0.72,
              evidenceIds: [
                "evidence_1",
              ],
            },
          ],
        }),
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          estimatedCostUsd: null,
        },
      };
    },
    async embed(request) {
      return {
        embeddings:
          request.input.map(
            () => [1]
          ),
        usage: {
          inputTokens: 1,
          outputTokens: 0,
          totalTokens: 1,
          estimatedCostUsd: null,
        },
      };
    },
  };
  const gateway = new AiGateway({
    provider,
    auditSink:
      new InMemoryAiAuditSink(),
    retriever: {
      async retrieve() {
        return {
          context:
            "Approved scientific evidence.",
          citations: [],
        };
      },
    },
  });
  const engine =
    new AgentExecutionEngine(
      gateway
    );
  const baseContext = {
    requestId:
      "agent_request_1",
    organizationId: "org_1",
    userId: "user_1",
    moduleIds: [
      "medical_affairs" as const,
    ],
    permissionTags: [
      "scientific_evidence",
    ],
  };

  const approval =
    await engine.execute({
      context: baseContext,
      agentId:
        "scientific_intelligence_advisor",
      request:
        "Create and export an evidence brief.",
      requestedToolIds: [
        "search",
        "reporting",
      ],
      retrievalQuery:
        "scientific evidence",
    });

  if (
    approval.status !==
      "approval_required" ||
    approval.plan[6]?.status !==
      "waiting"
  ) {
    throw new Error(
      "Side-effecting agent work must pause for human approval."
    );
  }

  const completed =
    await engine.execute({
      context: {
        ...baseContext,
        requestId:
          "agent_request_2",
        approved: true,
      },
      agentId:
        "scientific_intelligence_advisor",
      request:
        "Create and export an evidence brief.",
      requestedToolIds: [
        "search",
        "reporting",
      ],
      retrievalQuery:
        "scientific evidence",
    });

  if (
    completed.status !==
      "completed" ||
    completed.plan.length !==
      AGENT_LIFECYCLE.length ||
    completed.plan.some(
      (item) =>
        item.status !==
        "completed"
    ) ||
    completed.output?.claims[0]
      ?.evidenceIds[0] !==
      "evidence_1"
  ) {
    throw new Error(
      "Approved agent work must complete the shared lifecycle with evidence-backed output."
    );
  }

  const blocked =
    await engine.execute({
      context: {
        ...baseContext,
        requestId:
          "agent_request_3",
        moduleIds: [
          "patient",
        ],
      },
      agentId:
        "scientific_intelligence_advisor",
      request:
        "Analyze scientific evidence.",
    });

  if (
    blocked.status !==
    "blocked"
  ) {
    throw new Error(
      "Agent execution must refuse unlicensed module context."
    );
  }

  if (
    AGENT_EXECUTION_PROFILES.length !==
      8 ||
    AGENT_EXECUTION_PROFILES.some(
      (profile) =>
        !profile.jobDescription ||
        !profile.toolAllowlist ||
        !profile.approvalRules
          .length ||
        !profile.citationRequired ||
        !profile.evaluationSuiteId ||
        !profile.refusalBehavior
    )
  ) {
    throw new Error(
      "Every agent needs the complete governed execution profile."
    );
  }

  console.log(
    JSON.stringify(
      {
        lifecycle:
          AGENT_LIFECYCLE,
        profileCount:
          AGENT_EXECUTION_PROFILES.length,
        approvalStatus:
          approval.status,
        completedCapabilities:
          completed.capabilitiesUsed,
        blockedOutsideModule:
          blocked.status ===
          "blocked",
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
