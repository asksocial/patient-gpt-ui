# Three-layer platform experience

This is the product experience contract for the remaining intelligence-platform
roadmap.

## Layer 1: AskSocial Core

AskSocial is the single conversational interface and the default starting
point. Users describe the work they need completed; they do not choose between
competing chatbots. AskSocial may route a request across several licensed
capabilities, but the plan, progress, evidence, approvals, and result remain in
one continuous conversation.

The interface should describe work in user terms, such as “analyzing source
credibility” or “comparing historical narratives.” It must not expose internal
agent-to-agent orchestration.

## Layer 2: Licensed module context

Modules determine the domain data, ontology extensions, tools, workflows,
guardrails, and specialized capabilities available to the user. The global
module switcher changes this context without opening another product or
discarding the current conversation, workspace, or deliverable.

Only modules licensed and permitted for the current user may appear.

## Layer 3: Intelligence Modes and actions

Agents are implementation components. In the user experience they appear as
Intelligence Modes, suggested actions, slash commands, and defined workflows
inside AskSocial.

AskSocial selects a mode automatically by default. A user may deliberately
foreground a licensed mode, but doing so changes the conversation’s tools,
sources, prompts, outputs, and guardrails rather than opening a separate chat.
Only modes backed by agents licensed and permitted in the active module may
appear.

Agents should primarily manifest through concrete actions such as verifying
sources, analyzing a patient journey, comparing periods, assessing congress
impact, or generating an evidence brief. Complex work should disclose the
capabilities used and produce persistent work products in the current
workspace.

## Persistent workspace context

All three layers share the same workspace context: approved sources, audience,
therapeutic area, products, competitors, prior analyses, reporting periods,
output preferences, compliance rules, monitoring tasks, and approvals. Module
or mode changes must not silently discard that context.

## Progressive autonomy

Every workflow must declare one of three autonomy levels:

1. Assisted analysis: analyze and recommend; take no external action.
2. User-approved execution: prepare work and require approval before execution,
   publication, export, or another regulated action.
3. Persistent monitoring: run only an explicitly approved recurring workflow
   and notify the user according to configured thresholds.

Human approval, evidence, provenance, and auditability are part of the shared
experience, not optional features added separately by each agent.
