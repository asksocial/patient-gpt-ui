"use client";

import ActionButton from "./ui/ActionButton";

export default function ExplorationMentionTable({ items, theme, onOpenMention }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#d6e0db]" role="region" aria-label={`${theme} supporting mentions`} tabIndex={0}>
      <table className="w-full min-w-[880px] table-fixed text-left text-xs">
        <caption className="sr-only">Mentions supporting {theme}. Select a mention to read the full retained source.</caption>
        <colgroup><col className="w-[52%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[16%]" /></colgroup>
        <thead className="border-b border-[#d6e0db] bg-[#edf2ef] text-[#61736d]">
          <tr>{["Mention", "Source", "Market", "Original source"].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.findingId} className="border-b border-[#dfe6e2] text-[#52665e] last:border-b-0 hover:bg-[#edf2ef] focus-within:bg-[#edf2ef]">
              <td className="px-3 py-3 align-top">
                <ActionButton type="button" onClick={() => onOpenMention(item)} aria-label={`Read source ${item.findingId}`} className="block w-full cursor-pointer rounded text-left leading-5 text-[#11766b] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11766b]">
                  <span className="line-clamp-3 whitespace-pre-wrap break-words">{item.text}</span>
                  <span className="mt-1 block text-[11px] font-semibold">Read full mention →</span>
                </ActionButton>
              </td>
              <td className="break-words px-3 py-3 align-top leading-5">{item.platform || "Not recorded"}</td>
              <td className="break-words px-3 py-3 align-top leading-5">{item.countries || "Not recorded"}</td>
              <td className="px-3 py-3 align-top leading-5">{/^https?:\/\//i.test(item.url || "") ? <a href={item.url} target="_blank" rel="noreferrer" className="rounded font-medium text-[#11766b] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#11766b]" aria-label={`Open original source for ${item.findingId}`}>Open source ↗</a> : <span>Not supplied</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
