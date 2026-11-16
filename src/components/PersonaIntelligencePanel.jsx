"use client";
import { useId, useState } from "react";
import AudienceConversationPosts from "./AudienceConversationPosts";
import styles from "./PersonaIntelligencePanel.module.css";
import { groupClientAudiences } from "../answering/personas/clientAudienceGroups";

function AudienceSubtypeTable({ segments, combined = false, unit = "posts", onSelect }) {
  return (
    <div className="as-inset overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <caption className="px-4 py-3 text-left font-semibold text-white/85">{combined ? "Conversations and source evidence" : "Audience subtypes and classification evidence"}</caption>
        <thead className="border-y border-white/10 bg-white/[0.03] text-xs text-white/55"><tr>
          <th scope="col" className="px-4 py-3">Audience / source</th><th scope="col" className="px-4 py-3 text-right">{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className="px-4 py-3 text-right">Share</th><th scope="col" className="px-4 py-3">Main conversation types</th><th scope="col" className="px-4 py-3">Classification evidence</th>
        </tr></thead>
        <tbody>{segments.map(segment => <tr key={segment.id} className="border-b border-white/10 align-top last:border-0">
          <th scope="row" className="min-w-48 px-4 py-3 font-medium text-white/85"><span>{segment.label}</span><p className="mt-1 text-xs font-normal leading-5 text-white/50">{segment.description}</p></th>
          <td className="px-4 py-3 text-right tabular-nums text-white/80">{segment.count.toLocaleString()}</td>
          <td className="px-4 py-3 text-right tabular-nums text-white/80">{segment.percent}%</td>
          <td className="min-w-52 px-4 py-3 text-white/70">{segment.conversations.slice(0, 2).map(item => <p key={item.id} className="mb-1">{onSelect ? <button type="button" className={styles.conversationLink} onClick={() => onSelect({ ...item, ...(combined ? {} : { role: segment.id, roleLabel: segment.label }) })}>{item.label} ({item.count.toLocaleString()})</button> : <>{item.label} ({item.count.toLocaleString()})</>}</p>)}</td>
          <td className="min-w-48 px-4 py-3 text-xs text-white/65">{segment.authorOrSourceEvidenceCount > 0 ? <p className="mb-2 text-white/45">{segment.authorOrSourceEvidenceCount.toLocaleString()} with account/source attribution</p> : null}<details><summary className="cursor-pointer font-medium text-cyan-300">View examples & basis</summary>
            <ul className="mt-3 space-y-4">{segment.examples.map(example => <li key={example.id}>
              <p className="leading-5">{example.excerpt}</p>
              <p className="mt-2 text-white/45">Basis: {example.roleBasis.replaceAll("_", " ")}{example.roleEvidence.length ? ` · ${example.roleEvidence.join("; ")}` : " · speaker role not established"}</p>
              {example.url ? <a href={example.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-cyan-300 underline">Original source ↗</a> : <p className="mt-2 text-white/45">Source URL unavailable in the export.</p>}
            </li>)}</ul>
          </details></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function PublicConversationBreakdown({ segment, denominator, universe, unit = "posts", onSelect }) {
  return (
    <details open className="rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer font-semibold text-white/85">Inside public discussion · {segment.count.toLocaleString()} {unit}</summary>
      <p className="mt-2 text-xs leading-5 text-white/55">These {unit} do not establish the writer&apos;s personal or professional role. Their content can still be segmented. Every row below is a subset of public discussion; the share uses all {denominator.toLocaleString()} {universe} {unit}.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className="py-2 text-right">Share of {universe} {unit}</th></tr></thead>
        <tbody>{segment.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{onSelect ? <button type="button" className={styles.conversationLink} onClick={() => onSelect({ ...item, role: segment.id, roleLabel: segment.label })}>{item.label}</button> : item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / denominator * 10000) / 100}%</td></tr>)}</tbody>
      </table></div>
    </details>
  );
}

function AudienceGroup({ group, denominator, universe, unit = "posts", context }) {
  const [selection, setSelection] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const onSelect = context ? setSelection : undefined;
  const combinedPatientGroup = group.id === "patients_circle";
  const conversations = new Map();
  for (const subtype of group.subtypes) for (const item of subtype.conversations) {
    const current = conversations.get(item.id) || { ...item, count: 0 };
    current.count += item.count;
    conversations.set(item.id, current);
  }
  const combinedSegment = {
    ...group, conversations: [...conversations.values()].sort((a, b) => b.count - a.count),
    examples: group.subtypes.flatMap(subtype => subtype.examples).slice(0, 3),
    authorOrSourceEvidenceCount: group.subtypes.reduce((n, subtype) => n + subtype.authorOrSourceEvidenceCount, 0),
  };
  const publicSubtype = group.id === "general_public" ? group.subtypes.find(subtype => subtype.id === "public_discussion") : undefined;
  const action = group.excluded ? "View excluded records" : combinedPatientGroup ? "View conversations" : `View ${group.subtypes.length} ${group.subtypes.length === 1 ? "subtype" : "subtypes"}`;
  return <tbody className={`${styles.group} ${!group.count || group.excluded ? styles.muted : ""}`}>
    <tr className={styles.row}>
      <th scope="row"><button type="button" className={styles.name} aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}><span className={styles.chevron} data-expanded={expanded} aria-hidden="true">›</span>{group.label}</button></th>
      <td className="as-numeric"><span className={styles.track} role="img" aria-label={`${group.label}: ${formatShare(group.count, denominator)}`}><span style={{ width: `${denominator ? Math.min(100, group.count / denominator * 100) : 0}%` }} /></span></td>
      <td className={styles.posts}>{group.count.toLocaleString()}</td>
      <td className={styles.share}><strong>{formatShare(group.count, denominator)}</strong></td>
      <td className={styles.action}><button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{action}</button></td>
    </tr>
    <tr hidden={!expanded} id={detailsId}><td colSpan={5} className="as-numeric">
    <div className="space-y-4 border-t border-white/10 p-4">
      <p className="text-sm leading-6 text-white/65">{group.description}</p>
      {group.subtypes.length ? <AudienceSubtypeTable segments={combinedPatientGroup ? [combinedSegment] : group.subtypes} combined={combinedPatientGroup} unit={unit} onSelect={onSelect} /> : <p className="text-sm text-white/55">No {unit} in this group.</p>}
      {combinedPatientGroup ? <details open className="rounded-xl border border-white/10 p-4">
        <summary className="cursor-pointer font-semibold text-white/85">Conversation types · {group.count.toLocaleString()} {unit}</summary>
        <div className="as-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className="mt-3 w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className="py-2 text-right">Share of {universe} {unit}</th></tr></thead><tbody>
          {combinedSegment.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{onSelect ? <button type="button" className={styles.conversationLink} onClick={() => onSelect(item)}>{item.label}</button> : item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / denominator * 10000) / 100}%</td></tr>)}
        </tbody></table></div>
      </details> : null}
      {publicSubtype ? <PublicConversationBreakdown segment={publicSubtype} denominator={denominator} universe={universe} unit={unit} onSelect={onSelect} /> : null}
      {selection && context ? <AudienceConversationPosts key={`${context.therapeuticArea}:${context.corpusRevision}:${context.question}:${selection.id}:${selection.role || ""}`} context={context} group={group} selection={selection} onClose={() => setSelection(null)} /> : null}
    </div></td></tr>
  </tbody>;
}

const formatShare = (count, denominator) => `${denominator ? Number((count / denominator * 100).toFixed(1)) : 0}%`;

/** Corpus-wide share bars with native, keyboard-accessible evidence disclosures. */
export default function PersonaIntelligencePanel({ summary }) {
  const groups = summary.clientGroups || groupClientAudiences(summary.segments, summary.denominator);
  const audiences = groups.filter(group => !group.excluded).sort((a, b) => b.count - a.count);
  const exclusion = groups.find(group => group.excluded);
  const fullCorpus = summary.scope !== "selected_findings";
  const focused = summary.scope === "question_corpus";
  const universe = fullCorpus ? "corpus" : "selected";
  const denominator = summary.denominator;
  const unit = summary.recordUnit || "posts";
  const extraExcluded = Math.max(0, (summary.excludedFromAnalysisCount || 0) - (exclusion?.count || 0));
  return <div className={styles.panel}>
    <p className={styles.intro}>{denominator.toLocaleString()} {focused ? `matching ${unit}` : fullCorpus ? unit : `selected ${unit}`} · {audiences.length} audience groups · shares measure {unit}, not authors</p>
    <div className={styles.tableScroll} role="region" aria-label="Audience groups" tabIndex={0}>
      <div className="as-table-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}><table className={styles.table}>
        <thead><tr className={styles.columns}><th scope="col">Audience group</th><th scope="col">Share of corpus</th><th scope="col" className={styles.posts}>{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className={styles.share}>Share</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        {audiences.map(group => <AudienceGroup key={group.id} group={group} denominator={denominator} universe={universe} unit={unit} context={summary.evidenceContext} />)}
        {exclusion ? <tbody><tr><td colSpan={5} className={styles.exclusionNote}>Excluded from audience groups; included in the {denominator.toLocaleString()} denominator.</td></tr></tbody> : null}
        {exclusion ? <AudienceGroup group={exclusion} denominator={denominator} universe={universe} unit={unit} context={summary.evidenceContext} /> : null}
      </table></div>
    </div>
    <div className={styles.footer}>
      <p>{fullCorpus && summary.analyticalCount != null ? `${denominator.toLocaleString()} total = ${summary.analyticalCount.toLocaleString()} retained for thematic analytics + ${(exclusion?.count || 0).toLocaleString()} off-topic + ${extraExcluded.toLocaleString()} ${summary.additionalExclusionLabel || "spam/promotional"}` : `Shares use all ${denominator.toLocaleString()} selected ${unit}.`}</p>
      <details className={styles.method}>
        <summary>How shares are calculated</summary>
        <div>Each share is the group’s record count divided by {focused ? "the matching" : "all"} {denominator.toLocaleString()} {universe} {unit}. Groups are mutually exclusive; every record is counted once. All patient-related content is combined in Patients &amp; Their Circle. Off-topic records remain in the denominator, and other filtered records retain their audience designation while being excluded from thematic analytics. Displayed percentages are rounded to one decimal place, so they may not sum to exactly 100%. One author can contribute multiple {unit}.{denominator < 20 ? " This small sample is directional." : ""}</div>
      </details>
    </div>
    {summary.fullCorpus ? <details className="mt-6 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm font-semibold text-cyan-300">View overall corpus composition · {summary.fullCorpus.denominator.toLocaleString()} {unit}</summary><div className="mt-5"><PersonaIntelligencePanel summary={summary.fullCorpus} /></div></details> : null}
    <p className={styles.disclaimer}>Roles and conversation types are machine-inferred from source metadata and available text.</p>
  </div>;
}
