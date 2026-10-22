import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import KnowledgeGraphView from "../components/KnowledgeGraphView";
import { buildThemeKnowledgeSnapshot } from "../answering/knowledge/buildThemeKnowledgeSnapshot";
import { getThemeTaxonomy } from "../answering/themes/taxonomies";
import { buildThemeSourceAggregation } from "../answering/themes/buildThemeSourceAggregation";
import { graphArcLayout, graphMatchesTopic, graphSourceNames, graphTrajectory } from "../answering/knowledge/graphPresentation";
import type { ThemeMatch, ThemeSourceAggregation } from "../answering/themes/themeModels";

// The standalone JSX runner uses React's classic transform for .jsx files.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const render = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(KnowledgeGraphView, {
  snapshot: null, brief: null, longitudinalTracking: null, therapeuticArea: undefined, dataTherapeuticArea: undefined, ...props,
}));
const support = { count: 3, percentOfThemeFindings: 100, evidenceWeight: 3, weightedSharePercent: 100, averageEvidenceQualityScore: 1 };
const areas = ["GLP-1", "Hepatitis B", "Gene Therapy", "Botulinum toxin", "Medical Aesthetics", "Regenerative Aesthetics", "Uterine Fibroids", "New Disease State"];
const trajectories = ["emerging", "accelerating", "rising", "stable", "declining", "volatile", "insufficient"];
const snapshots = [];
for (const [areaIndex, area] of areas.entries()) {
  const taxonomy = getThemeTaxonomy(area)!;
  const category = areaIndex % 2 ? "caregiver_voice" : "research_or_science";
  const channel = areaIndex % 2 ? "medical_society" : "government";
  const aggregation: ThemeSourceAggregation = {
    ...buildThemeSourceAggregation([]),
    sourceCategories: { [category]: support, brand_owned: support, unknown: { ...support, count: 0 } },
    channels: { [channel]: support, social: { ...support, count: 0 } },
    distinctIndependentSourceCategoryCount: 1,
    distinctChannelCount: 1,
    isCrossSourceCorroborated: false,
    triangulationLabel: "single_source",
  };
  const themes = taxonomy.themes.slice(0, 4).map((definition, index) => ({
    themeId: definition.themeId, label: definition.label, description: definition.description,
    count: 3, percent: 40 / (index + 1), confidenceLabel: index ? "moderate" : "high",
    sourceAggregation: aggregation, findingIds: [`${areaIndex}:${index}`], representativeEvidence: [],
    countries: { "united kingdom": 3 }, personas: { caregiver: 3 }, platforms: { "ClinicalTrials.gov": 3 },
  } as unknown as ThemeMatch));
  const relationships = themes.slice(1).map((theme, index) => ({
    sourceThemeId: themes[0].themeId, targetThemeId: theme.themeId,
    relationshipType: "co_occurs_with" as const, strength: 0.8 - index * 0.2, confidence: "high" as const,
  }));
  const snapshot = buildThemeKnowledgeSnapshot({ therapeuticArea: area, themes, relationships });
  snapshots.push(snapshot);
  snapshot.themeRecords.forEach((record, index) => { record.trajectory = trajectories[(index + areaIndex) % trajectories.length] as typeof record.trajectory; });
  const html = render({ snapshot, therapeuticArea: area });
  assert.ok(html.includes("Knowledge graph containing 4 themes and 3 supported relationships"), area);
  assert.ok(html.includes("United Kingdom"), `${area}: actual markets`);
  assert.ok(html.includes(channel === "medical_society" ? "Medical Society" : "Government"), `${area}: actual channels`);
  assert.ok(html.includes(category === "caregiver_voice" ? "Caregiver Voice" : "Research or Science"), `${area}: actual categories`);
  assert.ok(!html.includes("Brand Owned"), `${area}: exclude commercial categories from independent sources`);
  assert.equal((html.match(/<table /g) || []).length, 1, `${area}: data-derived relationship group`);
  assert.ok(html.includes(`Co-occurs with ${themes[0].label.replaceAll("&", "&amp;")}`), `${area}: hub label`);
  assert.ok(snapshot.themeRecords.every((record) => record.isCrossSourceCorroborated === false));
  const layout = graphArcLayout(snapshot.themeRecords);
  assert.equal(layout.positions.size, 4);
  assert.ok(Array.from(layout.positions.values()).every((position) => Number.isFinite(position.radius)));
}
assert.ok(graphMatchesTopic("GLP-1", "glp_1", "glp1"));
assert.ok(graphMatchesTopic("Hepatitis B", "hep_b"));
assert.ok(!graphMatchesTopic("Hepatitis B", "glp_1"));
assert.ok(render({ snapshot: snapshots[0], therapeuticArea: "Hepatitis B" }).includes("Knowledge graph not available yet"));
assert.ok(render({ themes: [{ themeId: "stale", label: "Wrong topic", percent: 90 }], dataTherapeuticArea: "GLP-1", therapeuticArea: "Gene Therapy" }).includes("Knowledge graph not available yet"));
const emptySnapshot = { ...snapshots[0], themeRecords: [] };
assert.ok(render({ snapshot: emptySnapshot, themes: [{ themeId: "stale", label: "Stale theme" }] }).includes("Knowledge graph not available yet"));
const withoutEdges = render({ snapshot: { ...snapshots[0], relationships: [] }, relationships: snapshots[0].relationships });
assert.ok(withoutEdges.includes("AskSocial does not infer missing connections."));
assert.equal((withoutEdges.match(/<table /g) || []).length, 0);
const brief = { therapeuticArea: "hepatitis_b", topThemes: [{ themeId: "brief", label: "Brief only", eligiblePercent: 5 }] };
assert.ok(render({ brief, therapeuticArea: "Hepatitis B" }).includes("Not available in this analysis"));
assert.deepEqual(graphSourceNames(undefined), { independentSourceCategories: undefined, channels: undefined });
assert.equal(graphTrajectory("accelerating").arrow, "↗");
assert.equal(graphTrajectory("volatile").arrow, "↕");
assert.equal(graphTrajectory("insufficient").arrow, "—");
const manyThemes = Array.from({ length: 12 }, (_, index) => ({
  ...snapshots[0].themeRecords[0], themeId: `custom_${index}`, label: `Topic-specific theme ${index}`, eligiblePercent: 50 / (index + 1),
}));
const manyHtml = render({ snapshot: { ...snapshots[0], themeRecords: manyThemes, relationships: [] } });
assert.ok(manyHtml.includes("Knowledge graph containing 12 themes"), "Do not silently cap disease-specific taxonomies at ten themes");
assert.equal((manyHtml.match(/<circle /g) || []).length, 12);
const unknownSupport = render({ themes: [{ themeId: "unknown", label: "Missing source data", count: 1, percent: 10 }] });
assert.ok(unknownSupport.includes("Not available in this analysis"));
console.log(JSON.stringify({ areas, topicIsolation: true, authoritativeEmptySnapshots: true, dataDerivedLabelsAndGroups: true, allTrajectoryStates: true }, null, 2));
