import styles from "./PersonaIntelligencePanel.module.css";
import { groupClientAudiences } from "../answering/personas/clientAudienceGroups";

function AudienceSubtypeTable({ segments, combined = false, unit = "posts" }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <caption className="px-4 py-3 text-left font-semibold text-white/85">{combined ? "Conversations and source evidence" : "Audience subtypes and classification evidence"}</caption>
        <thead className="border-y border-white/10 bg-white/[0.03] text-xs text-white/55"><tr>
          <th scope="col" className="px-4 py-3">Audience / source</th><th scope="col" className="px-4 py-3 text-right">{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className="px-4 py-3 text-right">Share</th><th scope="col" className="px-4 py-3">Main conversation types</th><th scope="col" className="px-4 py-3">Classification evidence</th>
        </tr></thead>
        <tbody>{segments.map(segment => <tr key={segment.id} className="border-b border-white/10 align-top last:border-0">
          <th scope="row" className="min-w-48 px-4 py-3 font-medium text-white/85"><span>{segment.label}</span><p className="mt-1 text-xs font-normal leading-5 text-white/50">{segment.description}</p></th>
          <td className="px-4 py-3 text-right tabular-nums text-white/80">{segment.count.toLocaleString()}</td>
          <td className="px-4 py-3 text-right tabular-nums text-white/80">{segment.percent}%</td>
          <td className="min-w-52 px-4 py-3 text-white/70">{segment.conversations.slice(0, 2).map(item => <p key={item.id} className="mb-1">{item.label} <span className="text-white/45">({item.count.toLocaleString()})</span></p>)}</td>
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

function PublicConversationBreakdown({ segment, denominator, universe, unit = "posts" }) {
  return (
    <details open className="rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer font-semibold text-white/85">Inside public discussion · {segment.count.toLocaleString()} {unit}</summary>
      <p className="mt-2 text-xs leading-5 text-white/55">These {unit} do not establish the writer&apos;s personal or professional role. Their content can still be segmented. Every row below is a subset of public discussion; the share uses all {denominator.toLocaleString()} {universe} {unit}.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className="py-2 text-right">Share of {universe} {unit}</th></tr></thead>
        <tbody>{segment.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / denominator * 10000) / 100}%</td></tr>)}</tbody>
      </table></div>
    </details>
  );
}

function AudienceGroup({ group, denominator, universe, unit = "posts" }) {
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
  return <details className={styles.group}>
    <summary className={styles.row}>
      <span className={styles.name}><span className={styles.chevron} aria-hidden="true">▸</span>{group.label}</span>
      <span className={styles.track} aria-hidden="true"><span style={{ width: `${denominator ? group.count / denominator * 100 : 0}%`, background: GROUP_COLORS[group.id] }} /></span>
      <span className={styles.posts}><span className={styles.mobileLabel}>Posts: </span>{group.count.toLocaleString()}</span>
      <strong className={styles.share}>{formatShare(group.count, denominator)}</strong>
      <span className={styles.action}>{group.excluded ? "View excluded records" : combinedPatientGroup ? "View conversations" : `View ${group.subtypes.length} ${group.subtypes.length === 1 ? "subtype" : "subtypes"}`}</span>
    </summary>
    <div className="space-y-4 border-t border-white/10 p-4">
      <p className="text-sm leading-6 text-white/65">{group.description}</p>
      {group.subtypes.length ? <AudienceSubtypeTable segments={combinedPatientGroup ? [combinedSegment] : group.subtypes} combined={combinedPatientGroup} unit={unit} /> : <p className="text-sm text-white/55">No {unit} in this group.</p>}
      {combinedPatientGroup ? <details open className="rounded-xl border border-white/10 p-4">
        <summary className="cursor-pointer font-semibold text-white/85">Conversation types · {group.count.toLocaleString()} {unit}</summary>
        <table className="mt-3 w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">{unit === "records" ? "Records" : "Posts"}</th><th scope="col" className="py-2 text-right">Share of {universe} {unit}</th></tr></thead><tbody>
          {combinedSegment.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / denominator * 10000) / 100}%</td></tr>)}
        </tbody></table>
      </details> : null}
      {publicSubtype ? <PublicConversationBreakdown segment={publicSubtype} denominator={denominator} universe={universe} unit={unit} /> : null}
    </div>
  </details>;
}

const GROUP_COLORS = {
  general_public: "#11766b", media_advocacy: "#289f90", patients_circle: "#4eb3a5",
  industry_markets: "#6ac3b6", health_wellness_influencers: "#8dd1c7", healthcare_science: "#addfd7", excluded_off_topic: "#b9c4c0",
};
const formatShare = (count, denominator) => `${denominator ? Number((count / denominator * 100).toFixed(1)) : 0}%`;

/** Corpus-wide share bars with native, keyboard-accessible evidence disclosures. */
export default function PersonaIntelligencePanel({ summary }) {
  const groups = summary.clientGroups || groupClientAudiences(summary.segments, summary.denominator);
  const audiences = groups.filter(group => !group.excluded).sort((a, b) => b.count - a.count);
  const exclusion = groups.find(group => group.excluded);
  const ordered = [...audiences, ...(exclusion ? [exclusion] : [])];
  const fullCorpus = summary.scope !== "selected_findings";
  const focused = summary.scope === "question_corpus";
  const universe = fullCorpus ? "corpus" : "selected";
  const denominator = summary.denominator;
  const unit = summary.recordUnit || "posts";
  const extraExcluded = Math.max(0, (summary.excludedFromAnalysisCount || 0) - (exclusion?.count || 0));
  return <div className={styles.panel}>
    <p className={styles.intro}>{denominator.toLocaleString()} {focused ? `matching ${unit}` : fullCorpus ? unit : `selected ${unit}`} · {audiences.length} audience groups · shares measure {unit}, not authors</p>
    <div className={styles.composition}>
      <div className={styles.stacked} role="img" aria-label={`Audience composition across ${denominator.toLocaleString()} ${unit}: ${ordered.map(group => `${group.label} ${formatShare(group.count, denominator)}`).join("; ")}`}>
        {ordered.map(group => <span key={group.id} style={{ width: `${denominator ? group.count / denominator * 100 : 0}%`, background: GROUP_COLORS[group.id] }} title={`${group.label}: ${group.count.toLocaleString()} {unit} (${formatShare(group.count, denominator)})`} />)}
      </div>
      <ul className={styles.legend}>{ordered.map(group => <li key={group.id}><span style={{ background: GROUP_COLORS[group.id] }} aria-hidden="true" />{group.label} {formatShare(group.count, denominator)}</li>)}</ul>
    </div>
    <div role="region" aria-label="Audience groups">
      <div className={styles.columns} aria-hidden="true"><span>Audience group</span><span className={styles.barHeading}>Share of corpus</span><span className={styles.posts}>{unit === "records" ? "Records" : "Posts"}</span><span className={styles.share}>Share</span><span /></div>
      {audiences.map(group => <AudienceGroup key={group.id} group={group} denominator={denominator} universe={universe} unit={unit} />)}
    </div>
    {exclusion ? <div role="region" aria-label="Exclusion bucket" className={styles.exclusion}>
      <p>Excluded from audience groups; included in the {denominator.toLocaleString()} denominator.</p>
      <AudienceGroup group={exclusion} denominator={denominator} universe={universe} unit={unit} />
    </div> : null}
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
