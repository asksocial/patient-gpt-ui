# AskSocial Design System 2.0

## Design thesis

AskSocial should feel like an intelligence environment built for serious healthcare decision-making. Its visual system is organized around **From conversation to intelligence** and the progression:

**Human conversations → Evidence → Patterns → Intelligence → Decisions**

The redesign changes brand expression and information hierarchy while preserving workflows, APIs, permissions, analytical logic, PV controls, and underlying data structures.

## Existing-experience audit

### What remains

- Conversational inquiry as the primary entry point.
- Topic, workspace, and module context.
- Evidence-qualified responses and full-mention provenance.
- Specialized modules as analytical lenses over the same governed evidence.
- PV Compliance as a human-governed workflow with retained timestamps and audit history.
- Existing permission, entitlement, and administration behavior.

### What changes

- Navigation uses the user’s investigative mental model: **Ask, Explore, Analyze, Monitor, Verify, Manage**.
- Flat black is replaced by layered botanical ink, warm ivory, restrained mint, and signal gold.
- The query area becomes the primary visual anchor instead of looking like a conventional chat composer.
- Typography becomes more editorial, with clearer contrast between executive interpretation, metadata, and evidence.
- Containers use soft depth and tonal separation instead of repeated high-contrast outlines.

### What is simplified

- Platform-internal navigation terms are translated into task-oriented language without changing destinations.
- Equal visual weight across controls is reduced; primary actions, context, and secondary utilities are clearly separated.
- Empty states explain the intelligence journey instead of presenting an unadorned blank panel.

### What becomes prominent

- The active topic, workspace, and analytical lens.
- The query and its decision context.
- Evidence provenance and movement from insight to original mention.
- Human oversight and lifecycle state in PV Compliance.

### What previously felt generic

- Uniform black surfaces and repeated thin-outline cards.
- Navigation named after application structure rather than user intent.
- A conventional textarea-and-button chat pattern.
- Minimal differentiation between executive intelligence, supporting evidence, operational workflow, and metadata.

## Brand foundations

### Palette

| Token | Value | Purpose |
| --- | --- | --- |
| Botanical ink | `#071310` | Primary canvas |
| Soft ink | `#0d1f1b` | Navigation and recessed surfaces |
| Intelligence panel | `#102722` | Cards and analytical surfaces |
| Raised panel | `#15312b` | Hover and priority surfaces |
| Warm ivory | `#f4f0e6` | Primary text and actions |
| Intelligence mint | `#8ee8d6` | Queries, evidence, active context |
| Deep mint | `#3bb9a7` | Charts and sustained signals |
| Signal gold | `#d6b875` | Emerging or decision-worthy signals |
| Safety rose | `#ef8d91` | Exceptions and compliance risk |

Color never carries meaning alone; every governed state also includes a text label.

### Typography

- Display: system-first geometric sans, medium weight, tight tracking.
- Body: highly legible system sans with generous line height.
- Eyebrows and metadata: uppercase, compact, and widely tracked.
- Numerical intelligence: tabular figures where supported.

### Surfaces and depth

- Cards use tonal separation, faint mint borders, and soft ambient shadow.
- Modal surfaces are raised but remain part of the same ink spectrum.
- Dashed borders are reserved for genuine empty or incomplete states.
- Rounded geometry is consistent: 12px controls, 16px cards, 24px work areas.

## Interaction model

- **Ask** begins or resumes conversational investigation.
- **Explore** opens search, briefs, graph, and workspaces.
- **Analyze** applies licensed modules to the current governed evidence.
- **Monitor** manages active and scheduled intelligence work.
- **Verify** opens PV Compliance and its human-review workflow.
- **Manage** contains shared resources, governance, and administration.

All interactive elements retain visible focus, hover, active, disabled, loading, and error states. Reduced-motion preferences are respected.

## Evidence design

Evidence is a first-class product object. Every path should support:

**Insight → Theme → Supporting evidence → Full mention → Original source**

Mint identifies traceability and evidence actions. Signal gold identifies an emerging or decision-worthy condition. Source metadata remains quieter than the verbatim, while provenance controls remain visually discoverable.

## PV Compliance treatment

PV Compliance uses the same brand system with stronger state communication. Lifecycle, day-zero timing, ICSR element completeness, reviewer disposition, and sponsor handoff remain explicit. The visual design reinforces that algorithmic detection routes records for qualified human assessment and does not make a final regulatory determination.

## Responsive behavior

- The left rail remains collapsible and becomes an off-canvas context surface at smaller widths.
- When collapsed on desktop, the rail remains as an icon-only intelligence dock; contextual line icons and accessible labels preserve orientation without consuming the analytical canvas.
- Navigation can wrap without obscuring the current destination.
- The intelligence journey collapses before primary content or evidence.
- Tables remain horizontally scrollable rather than compressing governed fields.
