"use client";

import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  const [layer, setLayer] = useState("curated");
  const [therapeuticArea, setTherapeuticArea] = useState("");
  const [therapeuticAreas, setTherapeuticAreas] = useState([]);
  const [blockType, setBlockType] = useState("");

  useEffect(() => {
    async function loadTherapeuticAreas() {
      try {
        const res = await fetch("/api/therapeutic-areas");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load therapeutic areas");
        }

        const areas = Array.isArray(data?.therapeutic_areas)
          ? data.therapeutic_areas
          : [];

        setTherapeuticAreas(areas);

        if (areas.length && !areas.includes(therapeuticArea)) {
          setTherapeuticArea(areas[0]);
        }
      } catch (err) {
        console.error("Failed to load therapeutic areas:", err);
      }
    }

    loadTherapeuticAreas();
  }, []);

  async function onSend() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          therapeutic_area: therapeuticArea || null,
          layer,
          block_type: blockType || null,
          match_count: 6,
        }),
      });

      const raw = await res.text();

      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(
          `Non-JSON response (${res.status} ${res.statusText}): ${raw.slice(0, 300)}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setAnswer(data?.answer || "");
      setSources(Array.isArray(data?.sources) ? data.sources : []);
    } catch (e) {
      setAnswer(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const groupedSources = useMemo(() => {
    const insights = [];
    const voices = [];
    const other = [];

    for (const source of sources) {
      if (source?.block_type === "insight") {
        insights.push(source);
      } else if (source?.block_type === "voice") {
        voices.push(source);
      } else {
        other.push(source);
      }
    }

    return { insights, voices, other };
  }, [sources]);

  const sidebarButtonClass = (active) =>
    [
      "w-full text-left rounded-lg px-3 py-2 border transition",
      active
        ? "bg-white text-black border-white"
        : "bg-white/5 text-white border-white/10 hover:bg-white/10",
    ].join(" ");

  return (
    <main className="min-h-screen bg-black text-white flex">
      <aside className="w-[280px] border-r border-white/10 p-4 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Patient GPT</h1>
          <p className="text-sm text-white/60 mt-1">
            Query structured social intelligence.
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/50 mb-2">
            Layer
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className={sidebarButtonClass(layer === "curated")}
              onClick={() => setLayer("curated")}
            >
              Curated (Reports)
            </button>

            <button
              type="button"
              className={sidebarButtonClass(layer === "live")}
              onClick={() => setLayer("live")}
            >
              Live (Mentions)
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/50 mb-2">
            Therapeutic Area
          </div>
          <select
            value={therapeuticArea}
            onChange={(e) => setTherapeuticArea(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none"
          >
            {therapeuticAreas.length === 0 ? (
              <option value="">No therapeutic areas loaded</option>
            ) : (
              therapeuticAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-white/50 mb-2">
            Block Type
          </div>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none"
          >
            <option value="">All</option>
            <option value="insight">Insight</option>
            <option value="voice">Representative Voice</option>
          </select>
        </div>

        <div className="text-xs text-white/40 leading-5">
          Insight blocks summarize patterns across the conversation. Representative
          voice blocks show real patient/caregiver expressions that bring those
          patterns to life.
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-h-screen">
        <header className="border-b border-white/10 px-6 py-4">
          <div className="text-sm text-white/60">
            Ask a question about{" "}
            <span className="text-white">
              {therapeuticArea || "your repository"}
            </span>{" "}
            using the{" "}
            <span className="text-white">
              {layer === "curated" ? "Curated" : "Live"}
            </span>{" "}
            layer.
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/50 mb-3">
                Answer
              </div>

              {loading ? (
                <div className="text-white/70">Thinking…</div>
              ) : answer ? (
                <div className="whitespace-pre-wrap leading-7 text-white/90">
                  {answer}
                </div>
              ) : (
                <div className="text-white/50">
                  Ask a question like:
                  <div className="mt-2 text-white/80">
                    “What are the main barriers to gene therapy adoption?”
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs uppercase tracking-wide text-white/50">
                  Supporting Evidence
                </div>
                <div className="text-sm text-white/50">
                  {sources.length} result{sources.length === 1 ? "" : "s"}
                </div>
              </div>

              {!loading && !sources.length && answer && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
                  No sources returned.
                </div>
              )}

              {!!groupedSources.insights.length && (
                <SourceSection
                  title="Insights"
                  subtitle="Analyst-level pattern summaries"
                >
                  {groupedSources.insights.map((s, idx) => (
                    <InsightCard key={s?.id ?? `insight-${idx}`} source={s} />
                  ))}
                </SourceSection>
              )}

              {!!groupedSources.voices.length && (
                <SourceSection
                  title="Representative Voices"
                  subtitle="Direct human evidence from the conversation"
                >
                  {groupedSources.voices.map((s, idx) => (
                    <VoiceCard key={s?.id ?? `voice-${idx}`} source={s} />
                  ))}
                </SourceSection>
              )}

              {!!groupedSources.other.length && (
                <SourceSection
                  title="Other Sources"
                  subtitle="Ungrouped supporting material"
                >
                  {groupedSources.other.map((s, idx) => (
                    <FallbackSourceCard key={s?.id ?? `other-${idx}`} source={s} />
                  ))}
                </SourceSection>
              )}
            </div>
          </div>
        </div>

        <footer className="border-t border-white/10 p-4">
          <div className="max-w-5xl mx-auto flex gap-3">
            <input
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none"
              placeholder="Ask a question…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <button
              type="button"
              className="rounded-xl bg-white text-black px-5 py-3 font-medium disabled:opacity-50"
              onClick={onSend}
              disabled={loading}
            >
              {loading ? "Sending…" : "Send"}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}

function SourceSection({ title, subtitle, children }) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-white/50 mt-1">{subtitle}</div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InsightCard({ source }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40 mb-1">
            Insight
          </div>
          <div className="font-medium text-white">{source?.title || "Untitled"}</div>
          <div className="mt-1 text-xs text-white/50">
            {(source?.layer || "—")} • {(source?.quarter || "—")}
          </div>
        </div>

        {typeof source?.similarity === "number" && (
          <div className="text-xs text-white/50">
            Similarity: {source.similarity.toFixed(3)}
          </div>
        )}
      </div>

      {source?.content ? (
        <div className="mt-3 text-sm text-white/85 leading-6">{source.content}</div>
      ) : null}

      {source?.source ? (
        <div className="mt-3 text-xs text-white/40">Source: {source.source}</div>
      ) : null}
    </div>
  );
}

function VoiceCard({ source }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40 mb-1">
            Representative Voice
          </div>
          <div className="font-medium text-white">{source?.title || "Untitled"}</div>
          <div className="mt-1 text-xs text-white/50">
            {(source?.layer || "—")} • {(source?.quarter || "—")}
          </div>
        </div>

        {typeof source?.similarity === "number" && (
          <div className="text-xs text-white/50">
            Similarity: {source.similarity.toFixed(3)}
          </div>
        )}
      </div>

      {source?.content ? (
        <blockquote className="mt-3 border-l-2 border-white/20 pl-4 italic text-white/85 leading-6">
          “{source.content}”
        </blockquote>
      ) : null}

      {source?.source ? (
        <div className="mt-3 text-xs text-white/40">Source: {source.source}</div>
      ) : null}
    </div>
  );
}

function FallbackSourceCard({ source }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="font-medium text-white">{source?.title || "Untitled"}</div>
      <div className="mt-1 text-xs text-white/50">
        {(source?.layer || "—")} • {(source?.quarter || "—")}
      </div>

      {source?.content ? (
        <div className="mt-3 text-sm text-white/80 leading-6">{source.content}</div>
      ) : null}

      {source?.source ? (
        <div className="mt-3 text-xs text-white/40">Source: {source.source}</div>
      ) : null}
    </div>
  );
}