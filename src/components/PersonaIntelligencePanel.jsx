import { groupClientAudiences } from "../answering/personas/clientAudienceGroups";

function AudienceSubtypeTable({ segments, combined = false }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <caption className="px-4 py-3 text-left font-semibold text-white/85">{combined ? "Conversations and source evidence" : "Audience subtypes and classification evidence"}</caption>
        <thead className="border-y border-white/10 bg-white/[0.03] text-xs text-white/55"><tr>
          <th scope="col" className="px-4 py-3">Audience / source</th><th scope="col" className="px-4 py-3 text-right">Posts</th><th scope="col" className="px-4 py-3 text-right">Share</th><th scope="col" className="px-4 py-3">Main conversation types</th><th scope="col" className="px-4 py-3">Classification evidence</th>
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

function PublicConversationBreakdown({ segment, denominator, universe }) {
  return (
    <details open className="rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer font-semibold text-white/85">Inside public discussion · {segment.count.toLocaleString()} posts</summary>
      <p className="mt-2 text-xs leading-5 text-white/55">These posts do not establish the writer&apos;s personal or professional role. Their content can still be segmented. Every row below is a subset of public discussion; the share uses all {denominator.toLocaleString()} {universe} posts.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">Posts</th><th scope="col" className="py-2 text-right">Share of {universe} posts</th></tr></thead>
        <tbody>{segment.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / denominator * 10000) / 100}%</td></tr>)}</tbody>
      </table></div>
    </details>
  );
}

function AudienceGroup({ group, denominator, universe }) {
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
  return <details className="rounded-xl border border-white/10">
    <summary className="cursor-pointer px-4 py-4 text-white/85">
      <span className="ml-1 font-semibold">{group.label}</span>
      <span className="ml-3 text-sm font-normal text-white/70">{group.count.toLocaleString()} posts · {group.percent}%</span>
      <span className="ml-3 text-xs font-normal text-cyan-300">{group.excluded ? "View excluded records" : combinedPatientGroup ? "View conversations & evidence" : `View ${group.subtypes.length} ${group.subtypes.length === 1 ? "subtype" : "subtypes"}`}</span>
    </summary>
    <div className="space-y-4 border-t border-white/10 p-4">
      <p className="text-sm leading-6 text-white/65">{group.description}</p>
      {group.subtypes.length ? <AudienceSubtypeTable segments={combinedPatientGroup ? [combinedSegment] : group.subtypes} combined={combinedPatientGroup} /> : <p className="text-sm text-white/55">No posts in this group.</p>}
      {combinedPatientGroup ? <details open className="rounded-xl border border-white/10 p-4">
        <summary className="cursor-pointer font-semibold text-white/85">Conversation types · {group.count.toLocaleString()} posts</summary>
        <table className="mt-3 w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">Posts</th><th scope="col" className="py-2 text-right">Share of {universe} posts</th></tr></thead><tbody>
          {combinedSegment.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / denominator * 10000) / 100}%</td></tr>)}
        </tbody></table>
      </details> : null}
      {publicSubtype ? <PublicConversationBreakdown segment={publicSubtype} denominator={denominator} universe={universe} /> : null}
    </div>
  </details>;
}

/** Six client-facing voices, with granular roles and source evidence retained
 * inside native disclosures. Off-topic records are a separate, closed bucket. */
export default function PersonaIntelligencePanel({ summary }) {
  const groups = summary.clientGroups || groupClientAudiences(summary.segments, summary.denominator);
  const audiences = groups.filter(group => !group.excluded);
  const exclusion = groups.find(group => group.excluded);
  const fullCorpus = summary.scope === "full_corpus";
  const universe = fullCorpus ? "corpus" : "selected";
  return <div className="space-y-5">
    <p className="text-sm leading-6 text-white/70">
      {summary.denominator.toLocaleString()} {fullCorpus ? "posts in the full source corpus" : "selected posts"} · {audiences.length} audience groups, plus a separate off-topic bucket. Shares measure posts; one author can contribute more than one.
      {summary.denominator < 20 ? " This small sample is directional." : ""}
    </p>
    {fullCorpus ? <p className="text-xs leading-5 text-white/55">All source rows contribute to these shares. {summary.analyticalCount.toLocaleString()} posts are retained for thematic analytics; {summary.excludedFromAnalysisCount.toLocaleString()} excluded records remain designated here. The off-topic bucket contains {exclusion.count.toLocaleString()} records. Another {(summary.excludedFromAnalysisCount - exclusion.count).toLocaleString()} spam or promotional records are excluded only from thematic analytics. Shares always use all {summary.denominator.toLocaleString()} source rows.</p> : null}
    <section aria-label="Audience groups" className="space-y-3">
      <h4 className="font-semibold text-white/85">Whose voice is this?</h4>
      <p className="text-xs leading-5 text-white/55">Expand a group for conversation types and original-source evidence. Every percentage uses all {summary.denominator.toLocaleString()} {universe} posts.</p>
      {audiences.map(group => <AudienceGroup key={group.id} group={group} denominator={summary.denominator} universe={universe} />)}
    </section>
    <section aria-label="Exclusion bucket" className="space-y-2">
      <p className="text-xs text-white/50">Excluded from audience groups; included in the full denominator for reconciliation.</p>
      <AudienceGroup group={exclusion} denominator={summary.denominator} universe={universe} />
    </section>
    <p className="text-xs leading-5 text-white/50">Roles and conversation types are machine-inferred from source metadata and available text. Figures describe this {fullCorpus ? "source corpus" : "selected sample"}.</p>
  </div>;
}
