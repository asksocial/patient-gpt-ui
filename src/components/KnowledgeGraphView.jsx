"use client";

const NODE_TONES = {
  high: { fill: "#0f766e", stroke: "#5eead4" },
  moderate: { fill: "#155e75", stroke: "#67e8f9" },
  directional: { fill: "#854d0e", stroke: "#fcd34d" },
  insufficient: { fill: "#3f3f46", stroke: "#a1a1aa" },
};

function words(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function topSupport(values = {}, limit = 3) {
  return Object.entries(values)
    .filter(([label, count]) => label && Number(count) > 0)
    .sort((first, second) => Number(second[1]) - Number(first[1]))
    .slice(0, limit)
    .map(([label]) => words(label));
}

function normalizeThemes({ snapshot, themes, brief, longitudinalTracking }) {
  if (snapshot?.themeRecords?.length) return snapshot.themeRecords;

  if (themes?.length) {
    return themes.map((theme) => {
      const longitudinal = longitudinalTracking?.themes?.find(
        (item) => item.themeId === theme.themeId
      );

      return {
        themeId: theme.themeId,
        label: theme.label,
        description: theme.description,
        count: theme.count || 0,
        eligiblePercent:
          theme.prevalence?.eligiblePercent ?? theme.percent ?? 0,
        confidence: theme.confidenceLabel || "insufficient",
        triangulation:
          theme.sourceAggregation?.triangulationLabel || "insufficient",
        trajectory: longitudinal?.trajectory || "insufficient",
        independentSourceCategoryCount:
          theme.sourceAggregation?.distinctIndependentSourceCategoryCount || 0,
        channelCount: theme.sourceAggregation?.distinctChannelCount || 0,
        audiences: topSupport(theme.personas),
        markets: topSupport(theme.countries),
        platforms: topSupport(theme.platforms),
      };
    });
  }

  return (brief?.topThemes || []).map((theme) => ({
    ...theme,
    count: 0,
    description: "",
    independentSourceCategoryCount: 0,
    channelCount: 0,
  }));
}

function EmptyState({ therapeuticArea }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <div className="max-w-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-xl text-cyan-300">
          ◇
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">
          Knowledge graph not available yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/50">
          Ask a question about {therapeuticArea || "the selected therapeutic area"} first. AskSocial will map evidence-qualified themes and their supported relationships here.
        </p>
        <p className="mt-3 text-xs leading-5 text-white/35">
          Relationships are shown only when supported by the analyzed evidence; missing links are not inferred.
        </p>
      </div>
    </div>
  );
}

export default function KnowledgeGraphView({
  snapshot,
  themes = [],
  relationships = [],
  brief,
  longitudinalTracking,
  therapeuticArea,
}) {
  const nodes = normalizeThemes({
    snapshot,
    themes,
    brief,
    longitudinalTracking,
  }).slice(0, 10);
  const edges = (snapshot?.relationships?.length
    ? snapshot.relationships
    : relationships
  ).filter(
    (relationship) =>
      nodes.some((node) => node.themeId === relationship.sourceThemeId) &&
      nodes.some((node) => node.themeId === relationship.targetThemeId)
  );

  if (!nodes.length) return <EmptyState therapeuticArea={therapeuticArea} />;

  const centerX = 500;
  const centerY = 270;
  const orbitX = 355;
  const orbitY = 190;
  const positions = new Map(
    nodes.map((node, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / nodes.length;
      return [
        node.themeId,
        {
          x: centerX + Math.cos(angle) * orbitX,
          y: centerY + Math.sin(angle) * orbitY,
        },
      ];
    })
  );
  const corroboratedCount = nodes.filter(
    (node) =>
      !["single_source", "insufficient"].includes(node.triangulation)
  ).length;
  const datasetFindingCount =
    snapshot?.datasetFindingCount ||
    brief?.dataQuality?.datasetFindingCount ||
    0;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Themes", nodes.length],
          ["Supported links", edges.length],
          ["Corroborated themes", corroboratedCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 md:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
              Evidence-qualified topology
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {therapeuticArea || snapshot?.therapeuticArea || brief?.therapeuticArea}
            </h2>
          </div>
          <p className="text-xs text-white/35">
            {datasetFindingCount
              ? `${datasetFindingCount} analyzed findings`
              : "Based on the latest available analysis"}
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/35">
          <svg
            viewBox="0 0 1000 540"
            role="img"
            aria-label={`Knowledge graph containing ${nodes.length} themes and ${edges.length} supported relationships`}
            className="min-w-[760px]"
          >
            <defs>
              <marker
                id="knowledge-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
              </marker>
            </defs>

            {edges.map((relationship, index) => {
              const source = positions.get(relationship.sourceThemeId);
              const target = positions.get(relationship.targetThemeId);
              if (!source || !target) return null;

              return (
                <g
                  key={`${relationship.sourceThemeId}-${relationship.targetThemeId}-${index}`}
                >
                  <title>{`${words(relationship.relationshipType)} · ${Math.round(
                    Number(relationship.strength || 0) * 100
                  )}% strength · ${relationship.confidence} confidence`}</title>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="#52525b"
                    strokeWidth={
                      1.5 + Number(relationship.strength || 0) * 4
                    }
                    strokeDasharray={
                      relationship.relationshipType === "contrasts_with"
                        ? "8 7"
                        : undefined
                    }
                    markerEnd="url(#knowledge-arrow)"
                  />
                </g>
              );
            })}

            {nodes.map((node) => {
              const position = positions.get(node.themeId);
              const tone = NODE_TONES[node.confidence] || NODE_TONES.insufficient;
              const radius = Math.min(
                62,
                34 + Number(node.eligiblePercent || 0) * 0.7
              );
              const shortLabel =
                String(node.label).length > 24
                  ? `${String(node.label).slice(0, 22)}…`
                  : node.label;

              return (
                <g
                  key={node.themeId}
                  transform={`translate(${position.x} ${position.y})`}
                >
                  <title>{`${node.label} · ${node.eligiblePercent}% eligible prevalence · ${node.confidence} confidence · ${words(
                    node.triangulation
                  )} corroboration`}</title>
                  <circle
                    r={radius}
                    fill={tone.fill}
                    fillOpacity="0.76"
                    stroke={tone.stroke}
                    strokeWidth="2"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="600"
                  >
                    {shortLabel}
                  </text>
                  <text
                    y="22"
                    textAnchor="middle"
                    fill="#d4d4d8"
                    fontSize="12"
                  >
                    {node.eligiblePercent}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="mt-3 text-xs leading-5 text-white/35">
          Node size represents eligible prevalence. Lines represent detected relationships; line weight represents relationship strength. No unsupported links are inferred.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {nodes.map((node) => (
          <article
            key={node.themeId}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">{node.label}</h3>
                {node.description ? (
                  <p className="mt-1 text-sm leading-5 text-white/45">
                    {node.description}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/60">
                {node.eligiblePercent}%
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1">
                {words(node.confidence)} confidence
              </span>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1">
                {words(node.triangulation)} corroboration
              </span>
              {node.trajectory ? (
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1">
                  {words(node.trajectory)} trajectory
                </span>
              ) : null}
            </div>
            {node.independentSourceCategoryCount || node.channelCount ? (
              <p className="mt-3 text-xs text-white/40">
                {node.independentSourceCategoryCount || 0} independent source categories · {node.channelCount || 0} channels
              </p>
            ) : null}
            {[
              ["Audiences", node.audiences],
              ["Markets", node.markets],
              ["Platforms", node.platforms],
            ].map(([label, values]) =>
              values?.length ? (
                <p key={label} className="mt-2 text-xs text-white/40">
                  <span className="text-white/60">{label}:</span>{" "}
                  {values.join(", ")}
                </p>
              ) : null
            )}
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
          Supported relationships
        </h2>
        {edges.length ? (
          <div className="mt-4 space-y-2">
            {edges.map((relationship, index) => {
              const source = nodes.find(
                (node) => node.themeId === relationship.sourceThemeId
              );
              const target = nodes.find(
                (node) => node.themeId === relationship.targetThemeId
              );

              return (
                <div
                  key={`${relationship.sourceThemeId}-${relationship.targetThemeId}-${index}`}
                  className="flex flex-col justify-between gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <p className="text-sm text-white/75">
                    <span className="font-medium text-white">
                      {source?.label || words(relationship.sourceThemeId)}
                    </span>{" "}
                    <span className="text-cyan-300/70">
                      {words(relationship.relationshipType).toLowerCase()}
                    </span>{" "}
                    <span className="font-medium text-white">
                      {target?.label || words(relationship.targetThemeId)}
                    </span>
                  </p>
                  <p className="text-xs text-white/40">
                    {Math.round(Number(relationship.strength || 0) * 100)}%
                    strength · {words(relationship.confidence)} confidence
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-white/45">
            Themes are available, but this analysis did not produce sufficiently supported relationship edges. AskSocial does not infer missing connections.
          </p>
        )}
      </section>
    </div>
  );
}
