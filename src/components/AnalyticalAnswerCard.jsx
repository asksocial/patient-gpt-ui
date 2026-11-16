"use client";

import { useState } from "react";
import AudienceConversationPosts from "./AudienceConversationPosts";
import styles from "./AnalyticalAnswerCard.module.css";

function highlighted(text, themes) {
  const labels = themes.map(item => item.label.replace(/ only$/, "")).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!labels.length) return text;
  const pattern = new RegExp(`(${labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, index) => labels.some(label => label.toLowerCase() === part.toLowerCase()) ? <mark key={index}>{part}</mark> : part);
}

export default function AnalyticalAnswerCard({ answer, summary }) {
  const [showSources, setShowSources] = useState(false);
  const themes = (summary?.corpusCharts?.burdens?.segments || []).filter(item => item.id !== "remainder" && item.count > 0).sort((a, b) => b.count - a.count).slice(0, 2);
  // Only render attributed original social passages, never fallback synthesis.
  const sourceExamples = summary?.questionEvidence?.examples || (summary?.clientGroups || []).filter(group => !group.excluded).flatMap(group => group.subtypes.filter(subtype => ["patient", "caregiver", "family_peer", "patient_community"].includes(subtype.id)).flatMap(subtype => subtype.examples.map(example => ({ ...example, audience: subtype.label }))));
  const examples = sourceExamples.filter((item, index, all) => all.findIndex(other => other.id === item.id || other.excerpt === item.excerpt) === index).filter(item => item.sourceVerbatim && item.excerpt?.length >= 60 && !/^(QT|RT)\s|https?:\/\//i.test(item.excerpt) && /forum|social|comment|reddit|twitter|facebook|instagram|tiktok|youtube/i.test(item.sourceCategory || ""));
  const quotes = examples.slice(0, 2);
  const sentences = String(answer || "").split(/(?<=[.!?])\s+/);
  const caveatPattern = /further research|findings reflect|available conversations|time comparison is needed|cannot establish|not representative|directional|do not establish/i;
  const main = sentences.filter(sentence => !caveatPattern.test(sentence)).join(" ").trim();
  const caveats = sentences.filter(sentence => caveatPattern.test(sentence)).join(" ").trim();
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const range = summary?.dateRange;
  const markets = summary?.matchingMarketCount;
  return <section className={styles.card}>
    <div className={quotes.length ? styles.columns : undefined}>
      <div><h2 className={styles.eyebrow}>Analytical answer</h2>
        {main ? <p className={styles.finding}>{highlighted(main, themes)}</p> : null}
        {caveats ? <p className={styles.caveat}>{caveats}</p> : null}
        <div className={styles.chips}>
          {summary?.denominator != null ? <span>Based on {summary.denominator.toLocaleString()} matching posts</span> : null}
          {range?.start && range?.end ? <span>{dateFormat.format(new Date(range.start))} – {dateFormat.format(new Date(range.end))}</span> : null}
          {markets ? <span>{markets} {markets === 1 ? "market" : "markets"}</span> : null}
        </div>
      </div>
      {quotes.length ? <aside><h3 className={styles.quoteTitle}>In their words</h3>
        {quotes.map(quote => <figure className={styles.quote} key={quote.id}><blockquote>“{quote.excerpt}”</blockquote>{quote.audience || quote.country ? <figcaption>{[quote.audience, quote.country].filter(Boolean).join(" · ")}</figcaption> : null}</figure>)}
        {summary?.evidenceContext ? <button type="button" className={styles.link} aria-haspopup="dialog" onClick={() => setShowSources(true)}>View all source posts →</button> : null}
      </aside> : null}
    </div>
    {showSources && summary?.evidenceContext ? <AudienceConversationPosts context={summary.evidenceContext} group={{ id: "all", label: "All audience groups" }} selection={{ id: "all", label: "All matching source posts" }} onClose={() => setShowSources(false)} /> : null}
  </section>;
}
