"use client";

import { useEffect, useRef, useState } from "react";
import { activityFetch as fetch } from "../lib/client/requestActivity";
import BackButton from "./ui/BackButton";

const evidenceTextKey = value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

function ThemeSupportQuote({ text, terms = [] }) {
  const escaped = terms.filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return String(text).split(pattern).map((part, index) => terms.some(term => evidenceTextKey(term) === evidenceTextKey(part))
    ? <mark key={index} className="rounded bg-[#deeee6] px-0.5 text-[#123b32]">{part}</mark>
    : part);
}

export function ThemeMentionCards({ theme, examples }) {
  return <div className="mt-3 grid gap-3 lg:grid-cols-2">
    {examples.map(example => <article key={example.id} className="rounded-xl border border-white/10 p-4">
      <p className="mb-2 text-xs font-semibold text-cyan-200">Supports: {theme}</p>
      <blockquote className="text-sm leading-6 text-white/80"><ThemeSupportQuote text={example.excerpt} terms={example.matchedTerms} /></blockquote>
      <p className="mt-2 text-xs text-white/50">Relevant source wording: {example.matchedTerms.map(term => `“${term}”`).join(", ")}</p>
      {example.country || example.sourceCategory || example.language ? <p className="mt-2 text-xs text-white/40">{[example.country, example.sourceCategory, example.language].filter(Boolean).join(" · ")}</p> : null}
      {example.url ? <a href={example.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-cyan-200">Open original source ↗</a> : <p className="mt-3 text-xs text-white/50">Source URL was not supplied.</p>}
    </article>)}
  </div>;
}

export function ThemeMentionList({ therapeuticArea, question, topicId, theme, onBack }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResult(null); setError("");
      try {
        const params = new URLSearchParams({ therapeuticArea, question, topicId, q: query, page: String(page) });
        const response = await fetch(`/api/search/theme-evidence?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load mentions.");
        setResult(data.evidence);
      } catch (err) { if (err.name !== "AbortError") setError(err.message); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [therapeuticArea, question, topicId, query, page, retry]);
  return <section className="space-y-5">
    <BackButton onClick={onBack} />
    <header><p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Supporting conversation evidence</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">{result?.theme || theme || "Theme mentions"}</h1>
      <p className="mt-2 text-sm leading-6 text-white/60">Other relevant mentions supporting this theme. The two samples shown on Search are excluded from this list.</p>
    </header>
    <label className="block text-sm text-white/70">Search these mentions
      <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className="mt-2 block w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-white" placeholder="Search wording, country or source" />
    </label>
    <div aria-live="polite" aria-busy={!result && !error}>
      {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 underline">Try again</button></div> : !result ? <p className="text-sm text-white/60">Loading relevant mentions…</p> : <>
        <p className="text-sm text-white/60">{result.total} other relevant mentions{query ? " matching your search" : ""} · {result.totalMatched} supporting mentions in total</p>
        {result.items.length ? <ThemeMentionCards theme={result.theme} examples={result.items} /> : <p className="mt-4 text-sm text-white/60">{query ? "No mentions match this search." : "No additional supporting mentions are available beyond the Search samples."}</p>}
        <nav aria-label="Mention pages" className="mt-5 flex items-center justify-between gap-3 text-sm">
          <button type="button" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)} className="rounded-xl border border-white/15 px-4 py-2 disabled:opacity-40">Previous</button>
          <span>Page {result.page} of {result.pages}</span>
          <button type="button" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)} className="rounded-xl border border-white/15 px-4 py-2 disabled:opacity-40">Next</button>
        </nav>
      </>}
    </div>
  </section>;
}

export default function ConversationThemeEvidence({ theme, examples, topics = [], therapeuticArea, question }) {
  const [open, setOpen] = useState(false);
  const linkRef = useRef(null);
  const matching = examples.filter(example => evidenceTextKey(example.topic) === evidenceTextKey(theme) && example.matchedTerms?.some(term => evidenceTextKey(example.excerpt).includes(evidenceTextKey(term))));
  const topic = topics.find(item => item.id === matching[0]?.topicId);
  const close = () => { setOpen(false); linkRef.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = event => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const nodes = [...document.querySelectorAll('[data-theme-dialog] button:not(:disabled), [data-theme-dialog] a, [data-theme-dialog] input')];
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.querySelector('[data-theme-dialog] button')?.focus();
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!matching.length) return null;
  const href = `/search/evidence?${new URLSearchParams({ therapeuticArea: therapeuticArea || "", question: question || "", topicId: matching[0].topicId, theme })}`;
  const remaining = Math.max(0, (topic?.count || matching.length) - matching.length);
  return <div>
    <ThemeMentionCards theme={theme} examples={matching} />
    {matching.length < 2 ? <p className="mt-3 text-xs text-white/60">Only one distinct supporting mention is available for this theme.</p> : null}
    {therapeuticArea && question ? <a ref={linkRef} href={href} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setOpen(true); } }} className="mt-4 inline-block text-sm font-semibold text-cyan-200 underline underline-offset-4">View all {remaining} other relevant mentions for {theme} →</a> : null}
    {open ? <div role="dialog" aria-modal="true" aria-label={`Other mentions for ${theme}`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div data-theme-dialog className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/15 bg-[#102722] p-6 shadow-xl">
        <ThemeMentionList therapeuticArea={therapeuticArea} question={question} topicId={matching[0].topicId} theme={theme} onBack={close} />
      </div>
    </div> : null}
  </div>;
}
