"use client";

import { useState } from "react";
import { groupClientAudiences } from "../answering/personas/clientAudienceGroups";
import styles from "./CorpusDonutCards.module.css";

const RAMP = ["#1B6457", "#2E8574", "#4FA594", "#7FC2B3", "#9ED3C7"];
const rankColor = (index, total) => RAMP[index] || `hsl(164 32% ${85 + (index - RAMP.length + 1) / Math.max(1, total - RAMP.length) * 10}%)`;
const OTHER = "#C7D1CE";
const percent = (count, total) => total ? Number((count / total * 100).toFixed(1)) : 0;
const isOther = item => item.id === "remainder" || /^(other|unspecified|unknown)(\b|\s*\/)/i.test(item.label);
const ranked = segments => [...segments].filter(item => item.count > 0).sort((a, b) => Number(isOther(a)) - Number(isOther(b)) || b.count - a.count);

/** Both market and audience distributions share scale, ordering and accessibility. */
export function DistributionPanel({ title, subtitle, chart, concentrationNote, zeroGroups = [], footer }) {
  const segments = ranked(chart.segments);
  const leader = segments.find(item => !isOther(item)) || segments[0];
  if (!leader || !chart.denominator) return null;
  const share = percent(leader.count, chart.denominator);
  const label = segments.map(item => `${item.label}: ${percent(item.count, chart.denominator)}%`).join("; ");
  return <section className={styles.card}>
    <h3>{title}</h3><p className={styles.subtitle}>{subtitle}</p>
    <div className={styles.headline}><strong>{share}%</strong><span>{leader.label}</span></div>
    <div className={styles.stacked} role="img" aria-label={`${title}. ${label}`}>
      {segments.map((item, index) => <span key={item.id} style={{ width: `${item.count / chart.denominator * 100}%`, background: isOther(item) ? OTHER : rankColor(index, segments.length) }} />)}
    </div>
    <ul className={styles.legend}>{segments.map((item, index) => <li key={item.id}>
      <span className={styles.swatch} style={{ background: isOther(item) ? OTHER : rankColor(index, segments.length) }} aria-hidden="true" />
      <span>{item.label}</span><strong>{percent(item.count, chart.denominator)}%</strong>
    </li>)}</ul>
    {leader.count / chart.denominator >= 0.6 ? <p className={styles.callout}>{concentrationNote}</p> : null}
    {zeroGroups.length ? <div className={styles.zeroGroups}><p>No matching records from</p><div>{zeroGroups.map(item => <span key={item.id}>{item.label}</span>)}</div></div> : null}
    {footer ? <a className={styles.footer} href="#persona-breakdown">See persona breakdown ↓</a> : null}
  </section>;
}

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
