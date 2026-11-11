"use client";
import { useMemo, useState } from "react";

const PAGE_SIZE = 25;
const list = values => values.map(item => item.value).join(", ");

function ObservedValues({ values }) {
  if (values.length <= 3) return list(values);
  return <details><summary className="cursor-pointer">{list(values.slice(0, 3))} · +{values.length - 3} more</summary><p className="mt-2 leading-5">{list(values)}</p></details>;
}

export default function CorpusSourceRegistry({ registry }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const types = useMemo(() => [...new Set(registry.sources.flatMap(source => source.sourceTypes.map(item => item.value)))].sort(), [registry]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return registry.sources.filter(source => (!type || source.sourceTypes.some(item => item.value === type)) &&
      (!term || [source.name, source.domain, list(source.sourceNames), list(source.markets), list(source.languages), list(source.sourceTypes)].join(" ").toLowerCase().includes(term)));
  }, [registry, query, type]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  return <section aria-label="GLP-1 corpus source inventory" className="rounded-2xl border border-white/10 bg-black/20 p-5">
    <h2 className="text-lg font-semibold text-white/85">GLP-1 Corpus Sources</h2>
    <p className="mt-2 text-sm text-white/65">{registry.sourceCount.toLocaleString()} source domains · {registry.recordCount.toLocaleString()} source mentions · Full GLP-1 corpus</p>
    <p className="mt-2 text-xs leading-5 text-white/50">Populated from the original export, including records excluded from thematic analytics or held from PV screening. Markets and languages reflect mention metadata. These are corpus sources; ongoing monitoring, sponsor ownership, and screening cadence are configured separately below.</p>
    <div className="my-4 flex flex-wrap items-end gap-3">
      <label className="min-w-56 flex-1 text-xs text-white/60">Search sources, markets, or languages<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className="mt-1 block w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white" /></label>
      <label className="text-xs text-white/60">Source type<select value={type} onChange={event => { setType(event.target.value); setPage(1); }} className="mt-1 block rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"><option value="">All source types</option>{types.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <p role="status" className="mb-3 text-xs text-white/55">{filtered.length.toLocaleString()} matching sources · {filtered.length ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)}` : "No sources match"} · Page {currentPage} of {pages}</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
      <caption className="sr-only">Source domains represented in the GLP-1 corpus</caption>
      <thead className="text-white/40"><tr>{["Source", "Mentions", "Types", "Markets", "Languages", "Provenance"].map(heading => <th scope="col" key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead>
      <tbody>{filtered.slice(start, start + PAGE_SIZE).map(source => <tr key={source.id} className="border-t border-white/10 align-top text-white/65">
        <th scope="row" className="max-w-64 px-3 py-3 font-medium"><a href={source.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">{source.name}</a><p className="mt-1 break-all font-normal text-white/40">{source.domain}</p></th>
        <td className="px-3 py-3 tabular-nums">{source.mentionCount.toLocaleString()}</td>
        <td className="px-3 py-3">{list(source.sourceTypes)}</td>
        <td className="max-w-56 px-3 py-3"><ObservedValues values={source.markets} /></td>
        <td className="max-w-40 px-3 py-3"><ObservedValues values={source.languages} /></td>
        <td className="min-w-44 px-3 py-3"><details><summary className="cursor-pointer text-cyan-300">Source evidence</summary><p className="mt-2">Export source names: {list(source.sourceNames)}</p><p className="mt-2">Mention dates: {source.firstMentionDate || "Unspecified"} – {source.lastMentionDate || "Unspecified"}</p>{source.exampleUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-2 block text-cyan-300 underline">Original source {index + 1} ↗</a>)}</details></td>
      </tr>)}</tbody>
    </table></div>
    <div className="mt-4 flex items-center gap-3"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-40">Previous sources</button><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-40">Next sources</button></div>
    <p className="mt-4 text-xs text-white/40">Source: {registry.sourceFile} · Revision {registry.revision.slice(0, 12)}{registry.unattributedCount ? ` · ${registry.unattributedCount} mentions lack a source domain` : " · All mentions attributed to a source domain"}</p>
  </section>;
}
