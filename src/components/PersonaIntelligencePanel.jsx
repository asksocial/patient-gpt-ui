/** Roles describe source attribution; conversation types describe the content.
 * Native disclosures keep the full breakdown and provenance available without
 * requiring client state or another request.
 */
export default function PersonaIntelligencePanel({ summary }) {
  const publicGroup = summary.segments.find(segment => segment.id === "public_discussion");
  return <div className="space-y-5">
    <p className="text-sm leading-6 text-white/70">
      {summary.denominator.toLocaleString()} selected posts across {summary.roleCount} audience and source groups. Shares measure posts; one author can contribute more than one.
      {summary.denominator < 20 ? " This small sample is directional." : ""}
    </p>
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <caption className="px-4 py-3 text-left font-semibold text-white/85">Who is contributing, and what are they discussing?</caption>
        <thead className="border-y border-white/10 bg-white/[0.03] text-xs text-white/55"><tr>
          <th scope="col" className="px-4 py-3">Audience / source</th><th scope="col" className="px-4 py-3 text-right">Posts</th><th scope="col" className="px-4 py-3 text-right">Share</th><th scope="col" className="px-4 py-3">Main conversation types</th><th scope="col" className="px-4 py-3">Classification evidence</th>
        </tr></thead>
        <tbody>{summary.segments.map(segment => <tr key={segment.id} className="border-b border-white/10 align-top last:border-0">
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
    {publicGroup ? <details open className="rounded-xl border border-white/10 p-4">
      <summary className="cursor-pointer font-semibold text-white/85">Inside public discussion · {publicGroup.count.toLocaleString()} posts</summary>
      <p className="mt-2 text-xs leading-5 text-white/55">These posts do not establish the writer&apos;s personal or professional role. Their content can still be segmented. Every row below is a subset of public discussion; the share uses all {summary.denominator.toLocaleString()} selected posts.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-white/50"><tr><th scope="col" className="py-2">Conversation type</th><th scope="col" className="py-2 text-right">Posts</th><th scope="col" className="py-2 text-right">Share of selected posts</th></tr></thead>
        <tbody>{publicGroup.conversations.map(item => <tr key={item.id} className="border-t border-white/10 text-white/75"><th scope="row" className="py-2 font-normal">{item.label}</th><td className="py-2 text-right tabular-nums">{item.count.toLocaleString()}</td><td className="py-2 text-right tabular-nums">{Math.round(item.count / summary.denominator * 10000) / 100}%</td></tr>)}</tbody>
      </table></div>
    </details> : null}
    <p className="text-xs leading-5 text-white/50">Roles and conversation types are machine-inferred from source metadata and available text. Clinical credentials require explicit evidence; sharing news or research alone does not establish a journalist or researcher. Patient support community membership does not establish treatment use. Figures describe this selected sample.</p>
  </div>;
}
