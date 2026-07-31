"use client";

import { useEffect, useState } from "react";

function Card({ children }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">{children}</div>;
}

export default function IntelligenceLibrary({ view = "search", onUsePrompt }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadLibrary() {
    try {
      const [searchResponse, promptResponse] = await Promise.all([
        fetch("/api/library/searches", { cache: "no-store" }),
        fetch("/api/library/prompts", { cache: "no-store" }),
      ]);
      const [searchData, promptData] = await Promise.all([searchResponse.json(), promptResponse.json()]);
      if (searchData.ok) setSavedSearches(searchData.searches || []);
      if (promptData.ok) setPrompts(promptData.prompts || []);
    } catch {
      setMessage("The intelligence library could not be loaded.");
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  async function runSearch(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/intelligence/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Search failed");
      setResults(data.results || []);
      if (!data.results?.length) setMessage("No persisted intelligence matched this search.");
    } catch (error) {
      setMessage(error.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentSearch() {
    if (!query.trim()) return;
    const response = await fetch("/api/library/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim().slice(0, 80), query: query.trim() }),
    });
    const data = await response.json();
    setMessage(data.ok ? "Search saved to your intelligence library." : data.error || "Unable to save search.");
    if (data.ok) loadLibrary();
  }

  async function saveNewPrompt(event) {
    event.preventDefault();
    if (!promptName.trim() || !promptText.trim()) return;
    const response = await fetch("/api/library/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: promptName, prompt: promptText }),
    });
    const data = await response.json();
    if (data.ok) {
      setPromptName("");
      setPromptText("");
      setMessage("Prompt saved.");
      loadLibrary();
    } else {
      setMessage(data.error || "Unable to save prompt.");
    }
  }

  if (view === "search") {
    return (
      <div className="space-y-4">
        <Card>
          <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search evidence, reports, answers, and patient intelligence across workspaces"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40"
            />
            <button type="submit" disabled={loading} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">
              {loading ? "Searching…" : "Search"}
            </button>
            <button type="button" onClick={saveCurrentSearch} disabled={!query.trim()} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/70 disabled:opacity-30">
              Save search
            </button>
          </form>
          <p className="mt-3 text-xs text-white/35">Results are restricted to your organization, licensed modules, and persisted work products.</p>
        </Card>
        {message ? <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55">{message}</p> : null}
        <div className="grid gap-3">
          {results.map((result) => (
            <Card key={result.id}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
                <span className="rounded-full border border-white/10 px-2 py-0.5">{result.kind}</span>
                <span>{result.therapeutic_area || "Cross-therapeutic"}</span>
                <span>{Math.round((result.score || 0) * 100)}% match</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">{result.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/50">
                {result.payload?.summary || result.payload?.directAnswer || result.payload?.answer?.directAnswer || "Open the persisted work product to inspect its complete evidence-backed output."}
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Saved searches</h2>
        <div className="mt-4 space-y-2">
          {savedSearches.length ? savedSearches.map((search) => (
            <button key={search.id} onClick={() => { setQuery(search.query); onUsePrompt?.(search.query); }} className="block w-full rounded-xl border border-white/10 bg-black/30 p-3 text-left hover:border-white/20">
              <span className="block text-sm font-medium text-white/75">{search.name}</span>
              <span className="mt-1 block text-xs text-white/35">{search.query}</span>
            </button>
          )) : <p className="text-sm text-white/40">No saved searches yet.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Prompt library</h2>
        <form onSubmit={saveNewPrompt} className="mt-4 space-y-3">
          <input value={promptName} onChange={(event) => setPromptName(event.target.value)} placeholder="Prompt name" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none" />
          <textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} placeholder="Reusable AskSocial prompt" rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none" />
          <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Save prompt</button>
        </form>
        <div className="mt-5 space-y-2">
          {prompts.map((prompt) => (
            <button key={prompt.id} onClick={() => onUsePrompt?.(prompt.prompt)} className="block w-full rounded-xl border border-white/10 bg-black/30 p-3 text-left hover:border-white/20">
              <span className="block text-sm font-medium text-white/75">{prompt.name}</span>
              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-white/35">{prompt.prompt}</span>
            </button>
          ))}
        </div>
        {message ? <p className="mt-3 text-xs text-white/45">{message}</p> : null}
      </Card>
    </div>
  );
}
