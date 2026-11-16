"use client";

import { useState } from "react";
import { groupClientAudiences } from "../answering/personas/clientAudienceGroups";
import styles from "./ui/Charts.module.css";

import DistributionPanel from "./ui/DistributionPanel";
import { DATA_RAMP as RAMP, OTHER_COLOR as OTHER, formatShare as percent, isOtherCategory as isOther, rankedCategories as ranked } from "./ui/chartStyles";

export default function CorpusDonutCards({ summary }) {
  const [showAll, setShowAll] = useState(false);
  if (!summary?.corpusCharts || !["full_corpus", "question_corpus"].includes(summary.scope)) return null;
  const groups = (summary.clientGroups || groupClientAudiences(summary.segments, summary.denominator)).filter(item => !item.excluded);
  const themes = ranked(summary.corpusCharts.burdens.segments);
  const individual = themes.filter(item => !isOther(item));
  const top = individual.slice(0, 4);
  const remaining = themes.filter(item => !top.includes(item));
  const otherCount = remaining.reduce((sum, item) => sum + item.count, 0);
  const rows = [...top, ...(otherCount ? [{ id: "remainder", label: "Other themes", count: otherCount }] : [])];
  const largest = Math.max(...top.map(item => item.count), 1);
  const denominator = summary.corpusCharts.burdens.denominator;
  return <div className={styles.grid} aria-label="Corpus overview charts">
    <section className={styles.card}>
      <h3>Top experience themes</h3><p className={styles.subtitle}>Share of matching records</p>
      <div className={styles.themes} role="img" aria-label={`Top experience themes. ${rows.map(item => `${item.label}: ${percent(item.count, denominator)}%`).join("; ")}`}>
        {rows.map((item, index) => <div key={item.id} className={styles.theme}>
          <div><span>{item.label}</span><strong>{percent(item.count, denominator)}%</strong></div>
          <div className={styles.track}><span style={{ width: `${Math.min(100, item.count / largest * 100)}%`, background: isOther(item) ? OTHER : RAMP[index] }} /></div>
        </div>)}
      </div>
      <button type="button" className={styles.footer} aria-expanded={showAll} aria-controls="ask-all-themes" onClick={() => setShowAll(!showAll)}>See all themes →</button>
      {showAll ? <ul id="ask-all-themes" className={styles.legend}>{themes.map(item => <li key={item.id}><span>{item.label}</span><strong>{percent(item.count, denominator)}%</strong></li>)}</ul> : null}
    </section>
    <DistributionPanel title="Where it's coming from" subtitle="Share of matching records by market" chart={summary.corpusCharts.markets} concentrationNote="Heavily weighted to one market — read cross-market patterns with care." />
    <DistributionPanel title="Who's talking" subtitle="Share of matching source records by persona" chart={{ denominator: summary.denominator, segments: groups }} zeroGroups={groups.filter(item => item.count === 0)} concentrationNote="Mostly one persona — other perspectives are under-represented." footer />
  </div>;
}
