"use client";
import { getRankColor } from "./ui/chartStyles";


import { formatGraphMarket, graphArcLayout, graphSourceNames, graphMatchesTopic, graphTrajectory } from "../answering/knowledge/graphPresentation";


function words(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const CARD_STATUS_TONES = { confidence: "as-badge-success", corroboration: "as-badge-neutral", stable: "as-badge-neutral", declining: "as-badge-caution", rising: "as-badge-success", unknown: "as-badge-neutral" };

function CardStatus({ label, value, tone, level, arrow }) {
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border px-3 py-1.5 text-sm leading-5 ${CARD_STATUS_TONES[tone]}`}>
      <span className="opacity-70">{label}</span>
      {level !== undefined ? (
        <span aria-hidden="true" className="inline-flex gap-1">
          {[1, 2, 3].map((dot) => (
            <span key={dot} className={`h-1.5 w-1.5 rounded-full bg-current ${dot <= level ? "" : "opacity-15"}`} />
          ))}
        </span>
      ) : null}
      {arrow ? <span aria-hidden="true" className="font-semibold">{arrow}</span> : null}
      <span className="font-semibold">{words(value || "insufficient")}</span>
    </span>
  );
}

function sourceDetails(values, count, separator = ", ") {
  if (values?.length) return values.map(words).join(separator);
  if (count) return `${count} (names unavailable in this saved analysis)`;
  return Array.isArray(values) ? "None identified" : "Not available in this analysis";
}

function groupRelationships(nodes, edges) {
  const cooccurrences = edges.filter((edge) => edge.relationshipType === "co_occurs_with");
  const hub = nodes.map((node) => ({
    ...node,
    degree: cooccurrences.filter((edge) => edge.sourceThemeId === node.themeId || edge.targetThemeId === node.themeId).length,
  })).sort((first, second) => second.degree - first.degree)[0];
  const primary = hub?.degree > 1 ? cooccurrences.filter((edge) =>
    edge.sourceThemeId === hub.themeId || edge.targetThemeId === hub.themeId
  ) : [];
  const remaining = edges.filter((edge) => !primary.includes(edge));
  const byStrength = (values) => [...values].sort((first, second) => Number(second.strength || 0) - Number(first.strength || 0));
  return [
    ...(primary.length ? [{ title: `Co-occurs with ${hub.label}`, hubId: hub.themeId, edges: byStrength(primary) }] : []),
    ...(remaining.length ? [{ title: primary.length ? "Other supported pairs" : "Supported pairs", edges: byStrength(remaining) }] : []),
  ];
}

function RelationshipTable({ group, nodes }) {
  const name = (id) => nodes.find((node) => node.themeId === id)?.label || words(id);
  return (
    <div className="as-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table aria-label={group.title} className="w-full min-w-[760px] table-fixed border-collapse text-left">
      <colgroup><col className="w-[37%]" /><col className="w-[45%]" /><col className="w-[18%]" /></colgroup>
      <thead>
        <tr className="border-b border-[var(--as-track)]">
          <th scope="col" className="pb-4 pr-7 align-bottom">
            <h3 className="max-w-sm text-lg font-bold leading-snug text-[var(--as-text)] sm:text-xl">{group.title}</h3>
          </th>
          <th scope="col" className="pb-4 pr-7 align-bottom text-sm font-normal text-[var(--as-muted)] sm:text-base">Strength</th>
          <th scope="col" className="pb-4 align-bottom text-sm font-normal text-[var(--as-muted)] sm:text-base">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {group.edges.map((relationship, index) => {
          const source = name(relationship.sourceThemeId);
          const target = name(relationship.targetThemeId);
          const label = group.hubId
            ? name(relationship.sourceThemeId === group.hubId ? relationship.targetThemeId : relationship.sourceThemeId)
            : relationship.relationshipType === "co_occurs_with"
              ? `${source} ↔ ${target}`
              : `${source} ${words(relationship.relationshipType).toLowerCase()} ${target}`;
          const strength = Math.round(Math.max(0, Math.min(1, Number(relationship.strength) || 0)) * 100);
          const confidence = relationship.confidence || "insufficient";
          const level = { high: 3, moderate: 2, directional: 1 }[confidence] || 0;
          return (
            <tr key={`${relationship.sourceThemeId}-${relationship.targetThemeId}-${index}`} className="border-b border-[var(--as-track)] transition-colors hover:bg-[var(--as-track)]">
              <th scope="row" className="break-words py-4 pr-7 text-base font-normal leading-relaxed text-[var(--as-text)] sm:py-5 sm:text-lg">{label}</th>
              <td className="py-4 pr-7 sm:py-5">
                <div className="flex items-center gap-5">
                  <div role="meter" aria-label={`${label} relationship strength`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={strength}
                    className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--as-track)]">
                    <div className="h-full rounded-full bg-[var(--as-primary)]" role="img" aria-label={`Relationship strength: ${strength}%`} style={{ width: `${strength}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-lg font-bold tabular-nums text-[var(--as-text)] sm:text-xl">{strength}%</span>
                </div>
              </td>
              <td className="py-4 sm:py-5">
                <div className="flex items-center gap-3 text-sm text-[var(--as-muted)] sm:text-base">
                  <span aria-hidden="true" className="inline-flex shrink-0 gap-1">
                    {[1, 2, 3].map((dot) => <span key={dot} className={`h-2 w-2 rounded-full ${dot <= level ? "bg-[var(--as-tint)]" : "bg-[var(--as-track)]"}`} />)}
                  </span>
                  <span>{words(confidence)}</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}

function topSupport(values = {}, limit = 3) {
  return Object.entries(values)
    .filter(([label, count]) => label && Number(count) > 0)
    .sort((first, second) => Number(second[1]) - Number(first[1]))
    .slice(0, limit)
    .map(([label]) => words(label));
}

function normalizeThemes({ snapshot, themes, brief, longitudinalTracking }) {
  if (snapshot) {
    return (snapshot.themeRecords || []).map((record) => {
      const theme = themes?.find((item) => item.themeId === record.themeId);
      return {
        ...record,
        isCrossSourceCorroborated: record.isCrossSourceCorroborated ?? theme?.sourceAggregation?.isCrossSourceCorroborated,
        independentSourceCategories: record.independentSourceCategories ??
          (theme ? graphSourceNames(theme.sourceAggregation).independentSourceCategories : undefined),
        channels: record.channels ??
          (theme ? graphSourceNames(theme.sourceAggregation).channels : undefined),
        audiences: record.audiences ?? topSupport(theme?.personas),
        markets: record.markets ?? topSupport(theme?.countries),
        platforms: record.platforms ?? topSupport(theme?.platforms),
      };
    });
  }

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
        ...graphSourceNames(theme.sourceAggregation),
        isCrossSourceCorroborated: theme.sourceAggregation?.isCrossSourceCorroborated,
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
  }));
}

function EmptyState({ therapeuticArea }) {
  return (
    <div className="as-inset flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <div className="max-w-xl">
        <div className="as-inset mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-xl text-cyan-300">
          ◇
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">
          Knowledge graph not available yet
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/50">
          Ask a question about {therapeuticArea || "the selected topic"} first. AskSocial will map evidence-qualified themes and their supported relationships here.
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
  dataTherapeuticArea,
  onOpenTheme = undefined,
}) {
  if (!graphMatchesTopic(therapeuticArea, dataTherapeuticArea, snapshot?.therapeuticArea, brief?.therapeuticArea)) {
    return <EmptyState therapeuticArea={therapeuticArea} />;
  }
  const nodes = normalizeThemes({
    snapshot,
    themes,
    brief,
    longitudinalTracking,
  }).sort((first, second) => Number(second.eligiblePercent || 0) - Number(first.eligiblePercent || 0));
  const edges = (snapshot ? snapshot.relationships ?? [] : relationships).filter(
    (relationship) =>
      nodes.some((node) => node.themeId === relationship.sourceThemeId) &&
      nodes.some((node) => node.themeId === relationship.targetThemeId)
  );

  if (!nodes.length) return <EmptyState therapeuticArea={therapeuticArea} />;

  const { width: graphWidth, height: graphHeight, baseline, positions } = graphArcLayout(nodes);
  const datasetFindingCount =
    snapshot?.datasetFindingCount ??
    brief?.dataQuality?.datasetFindingCount ??
    0;

  return (
    <div className="space-y-5">
      <section className="as-card rounded-3xl border border-[var(--as-track)] bg-[var(--as-card)] p-5 sm:p-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[var(--as-primary)]">
              Evidence-qualified topology
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--as-text)]">
              {therapeuticArea || snapshot?.therapeuticArea || brief?.therapeuticArea}
            </h2>
          </div>
          <p className="text-base text-[var(--as-muted)]">
            {datasetFindingCount
              ? `${datasetFindingCount} analyzed findings`
              : "Based on the latest available analysis"}
          </p>
        </div>

        <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable theme arc diagram">
          <svg
            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
            role="img"
            aria-label={`Knowledge graph containing ${nodes.length} themes and ${edges.length} supported relationships. Circle area represents eligible prevalence; arc thickness represents relationship strength.`}
            className="block w-full"
            style={{ minWidth: Math.min(graphWidth, Math.max(680, nodes.length * 130)) }}
          >
            <line x1="48" y1={baseline} x2={graphWidth - 48} y2={baseline} stroke="var(--as-track)" strokeWidth="1.5" />
            {edges.map((relationship, index) => {
              const source = positions.get(relationship.sourceThemeId);
              const target = positions.get(relationship.targetThemeId);
              if (!source || !target || source.x === target.x) return null;
              const left = Math.min(source.x, target.x);
              const right = Math.max(source.x, target.x);
              const distance = right - left;
              const strength = Math.max(0, Math.min(1, Number(relationship.strength) || 0));
              return (
                <path
                  key={`${relationship.sourceThemeId}-${relationship.targetThemeId}-${index}`}
                  d={`M ${left} ${baseline} A ${distance / 2} ${distance * 0.31} 0 0 1 ${right} ${baseline}`}
                  fill="none"
                  stroke="var(--as-data-other)"
                  strokeWidth={1.2 + strength * 7}
                  strokeLinecap="round"
                  strokeDasharray={relationship.relationshipType === "contrasts_with" ? "7 6" : undefined}
                >
                  <title>{`${source.label} → ${target.label} · ${words(relationship.relationshipType)} · ${Math.round(strength * 100)}% strength · ${words(relationship.confidence)} confidence`}</title>
                </path>
              );
            })}
            {nodes.map((node, index) => {
              const position = positions.get(node.themeId);
              return (
                <g key={node.themeId} transform={`translate(${position.x} ${baseline})`}>
                  <title>{`${node.label} · ${node.eligiblePercent}% eligible prevalence · ${words(node.confidence)} confidence · ${words(node.triangulation)} corroboration`}</title>
                  <circle r={position.radius} fill={getRankColor(index, nodes.length)} stroke="var(--as-track)" strokeWidth="3" />
                  <text textAnchor="middle" fill="var(--as-text)" fontSize="18" fontWeight="600">
                    {position.lines.map((line, lineIndex) => (
                      <tspan key={lineIndex} x="0" y={82 + lineIndex * 23}>{line}</tspan>
                    ))}
                  </text>
                  <text x="0" y={82 + position.lines.length * 23 + 5} textAnchor="middle" fill="var(--as-text)" fontSize="18">
                    {node.eligiblePercent}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-[var(--as-muted)] sm:text-base">
          <span className="inline-flex items-center gap-3">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full bg-[var(--as-tint)]" />
            Area = prevalence
          </span>
          {[["Weak", 1.5], ["Moderate", 4], ["Strong", 7]].map(([label, thickness]) => (
            <span key={label} className="inline-flex items-center gap-3">
              <span aria-hidden="true" className="inline-block w-10 rounded-full bg-[var(--as-primary)]" style={{ height: thickness }} />
              {label}
            </span>
          ))}
        </div>
        <p className="sr-only">
          Circle area represents eligible prevalence. Arcs represent detected relationships; arc thickness represents relationship strength. No unsupported links are inferred.
        </p>
      </section>

      <section className="as-layout-section grid gap-5 xl:grid-cols-2">
        {nodes.map((node, index) => {
          const percent = Math.max(0, Math.min(100, Number(node.eligiblePercent) || 0));
          const largestPercent = Math.max(1, ...nodes.map((item) => Number(item.eligiblePercent) || 0));
          const trajectory = node.trajectory || "insufficient";
          const trend = graphTrajectory(trajectory);
          return (
            <article
              key={node.themeId}
              className="as-card flex min-w-0 flex-col rounded-3xl border border-[var(--as-track)] bg-[var(--as-card)] p-5 sm:p-7"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3">
                <span aria-hidden="true" className="text-sm font-medium tabular-nums text-[var(--as-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="min-w-0 text-lg font-bold leading-snug text-[var(--as-text)] sm:text-xl">{onOpenTheme ? <button type="button" onClick={()=>onOpenTheme(node.themeId)} className="text-left underline underline-offset-4">{node.label}</button> : node.label}</h3>
                <p className="whitespace-nowrap text-3xl font-bold leading-none tracking-tight tabular-nums text-[var(--as-text)] sm:text-4xl">
                  {percent}<span className="ml-0.5 text-lg font-semibold text-[var(--as-muted)]">%</span>
                </p>
                {node.description ? (
                  <p className="col-start-2 col-end-4 mt-2 text-sm leading-6 text-[var(--as-muted)] sm:text-base">
                    {node.description}
                  </p>
                ) : null}
              </div>
              <div
                role="meter"
                aria-label="Eligible prevalence, relative to the largest displayed theme"
                aria-valuemin={0}
                aria-valuemax={largestPercent}
                aria-valuenow={percent}
                aria-valuetext={`${percent}% eligible prevalence`}
                className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--as-track)]"
              >
                <div className="h-full rounded-full bg-[var(--as-primary)]" role="img" aria-label={`Theme share: ${percent}%`} style={{ width: `${(percent / largestPercent) * 100}%` }} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <CardStatus label="Confidence" value={node.confidence} tone="confidence"
                  level={{ high: 3, moderate: 2, directional: 1 }[node.confidence] || 0} />
                <CardStatus label="Corroboration" value={node.triangulation} tone="corroboration"
                  level={{ strong: 3, moderate: 2, directional: 1, single_source: 1 }[node.triangulation] || 0} />
                <CardStatus label="Trajectory" value={trajectory} tone={trend.tone}
                  arrow={trend.arrow} />
              </div>
              <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 border-t border-[var(--as-track)] pt-5 text-sm leading-6">
                {[
                  ["Sources", sourceDetails(node.independentSourceCategories, node.independentSourceCategoryCount, " · ").replace(/\bOr\b/g, "or")],
                  ["Channels", sourceDetails(node.channels, node.channelCount)],
                  ["Markets", node.markets?.length ? node.markets.map(formatGraphMarket).join(", ") : null],
                  ["Platforms", node.platforms?.length ? node.platforms.map(words).join(", ") : null],
                  ["Audiences", node.audiences?.length ? node.audiences.map(words).join(", ") : null],
                ].map(([label, value]) => value ? (
                  <div key={label} className="contents">
                    <dt className="text-[var(--as-muted)]">{label}</dt>
                    <dd className="min-w-0 break-words text-[var(--as-muted)]">{value}</dd>
                  </div>
                ) : null)}
              </dl>
            </article>
          );
        })}
      </section>

      <section className="as-card rounded-3xl border border-[var(--as-track)] bg-[var(--as-card)] p-5 sm:p-8">
        <h2 className="text-base font-bold text-[var(--as-text)]">
          Supported relationships
        </h2>
        {edges.length ? (
          <div tabIndex={0} role="region" aria-label="Scrollable supported relationship tables" className="mt-8 space-y-8 overflow-x-auto">
            {groupRelationships(nodes, edges).map((group) => (
              <RelationshipTable key={group.title} group={group} nodes={nodes} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--as-muted)]">
            Themes are available, but this analysis did not produce sufficiently supported relationship edges. AskSocial does not infer missing connections.
          </p>
        )}
      </section>
    </div>
  );
}
