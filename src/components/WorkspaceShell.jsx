"use client";

import { useEffect, useMemo, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Tooltip from "./ui/Tooltip";

const QUICK_ACTIONS = [
  "What are people saying right now?",
  "What’s emerging in live conversation beyond the report baseline?",
  "What themes are driving confusion or concern?",
  "What’s changed since the last report?",
];

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatInsightTypeLabel(value) {
  if (!value) return "Curated Insight";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function Badge({ children, tone = "default", tooltip }) {
  const styles = {
    default: "border-white/10 bg-white/5 text-white/70",
    emerging: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    partial: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    covered: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    cluster: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    noise: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    insight: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    country: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300",
    persona: "border-lime-500/20 bg-lime-500/10 text-lime-300",
    platform: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    action: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  };

  const pill = (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.default}`}
    >
      {children}
    </span>
  );

  if (!tooltip) return pill;

  return (
    <Tooltip content={tooltip} delay={250} side="top" align="center">
      {pill}
    </Tooltip>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-sm text-white/45">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function groupInsightsByCountry(insights = []) {
  return insights.reduce((acc, insight) => {
    const key = insight.country || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(insight);
    return acc;
  }, {});
}

function buildMarketDifferenceBullets(insights = []) {
  const grouped = groupInsightsByCountry(insights);

  const countries = Object.keys(grouped).filter(
    (country) => country !== "Global" && country !== "Other"
  );

  if (countries.length < 2) return [];

  return countries
    .map((country) => {
      const topInsights = [...grouped[country]]
        .sort(
          (a, b) =>
            (typeof b.importance === "number" ? b.importance : 0) -
            (typeof a.importance === "number" ? a.importance : 0)
        )
        .slice(0, 2);

      const summary = topInsights
        .map((item) => item.summary || item.title)
        .filter(Boolean)
        .join(" ");

      return { country, summary };
    })
    .slice(0, 4);
}

function KeyMarketDifferences({ insights = [] }) {
  const bullets = buildMarketDifferenceBullets(insights);

  if (bullets.length < 2) return null;

  return (
    <Panel
      title="Key Market Differences"
      subtitle="High-level comparison across the most relevant countries in the retrieved curated intelligence"
    >
      <div className="space-y-3">
        {bullets.map((item) => (
          <div
            key={item.country}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
          >
            <p className="text-sm leading-6 text-white/75">
              <span className="font-semibold text-white">{item.country}:</span>{" "}
              {item.summary}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RelevantCuratedInsights({ insights = [] }) {
  if (!insights.length) return null;

  const grouped = groupInsightsByCountry(insights);

  const orderedCountries = Object.keys(grouped).sort((a, b) => {
    if (a === "Global") return 1;
    if (b === "Global") return -1;
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  return (
    <Panel
      title="Relevant Curated Insights"
      subtitle="Structured country, persona, platform, barrier, trust, and information signals used to ground the answer"
    >
      <div className="space-y-6">
        {orderedCountries.map((country) => (
          <div key={country}>
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/85">
                {country}
              </h4>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {grouped[country].map((insight, idx) => (
                <div
                  key={insight.id || `${insight.title}-${idx}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-semibold text-white">
                      {insight.title}
                    </h5>

                    <Badge
                      tone="insight"
                      tooltip="The normalized curated insight type used for retrieval and synthesis."
                    >
                      {formatInsightTypeLabel(insight.insight_type)}
                    </Badge>

                    {insight.persona ? (
                      <Badge
                        tone="persona"
                        tooltip="Patient or audience segment reflected in this curated insight."
                      >
                        {insight.persona}
                      </Badge>
                    ) : null}

                    {insight.platform ? (
                      <Badge
                        tone="platform"
                        tooltip="Primary platform or channel associated with this curated insight."
                      >
                        {insight.platform}
                      </Badge>
                    ) : null}
                  </div>

                  {insight.summary ? (
                    <p className="mt-3 text-sm leading-6 text-white/70">
                      {insight.summary}
                    </p>
                  ) : null}

                  {insight.evidence_excerpt ? (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        Evidence Excerpt
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/55">
                        {insight.evidence_excerpt}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecommendedActions({ actions = [] }) {
  if (!actions.length) return null;

  return (
    <Panel
      title="Recommended Actions"
      subtitle="Suggested next moves based on the strongest current signals"
    >
      <div className="space-y-3">
        {actions.map((action, idx) => (
          <div
            key={`${action}-${idx}`}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <Badge
                tone="action"
                tooltip="A practical next step derived from the strongest curated and live signals."
              >
                Action {idx + 1}
              </Badge>
              <p className="text-sm leading-6 text-white/75">{action}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssistantAnswer({ responsePayload }) {
  const answer = responsePayload?.answer || null;
  const curatedInsights = responsePayload?.relevantCuratedInsights || [];
  const curatedThemes = answer?.curatedIntelligence?.themes || [];
  const liveThemes = answer?.liveData?.themes || [];
  const emergingNarratives = answer?.liveData?.emergingNarratives || [];
  const recommendedActions = answer?.recommendedActions || [];

  if (!answer) return null;

  return (
    <div className="space-y-4">
      <Panel
        title="Direct Answer"
        subtitle="Report-backed, live-enhanced summary"
      >
        <p className="text-[15px] leading-7 text-white/80">
          {answer.directAnswer}
        </p>
      </Panel>

      <KeyMarketDifferences insights={curatedInsights} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="From Curated Intelligence"
          subtitle="Baseline themes from existing reports"
        >
          <div className="space-y-4">
            {curatedThemes.length ? (
              curatedThemes.map((theme, idx) => (
                <div
                  key={`${theme.name}-${idx}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <h4 className="text-sm font-semibold text-white">
                    {theme.name}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {theme.description}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/40">
                No baseline report themes were available for this response.
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="What’s Emerging In Live Data"
          subtitle={
            emergingNarratives.length
              ? `${emergingNarratives.length} emerging narrative${emergingNarratives.length > 1 ? "s" : ""} detected`
              : "Live themes aligned to baseline"
          }
        >
          <div className="space-y-4">
            {liveThemes.length ? (
              liveThemes.map((theme, idx) => (
                <div
                  key={`${theme.name}-${idx}`}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">
                      {theme.name}
                    </h4>

                    <Badge
                      tone={
                        theme.relationship === "emerging"
                          ? "emerging"
                          : theme.relationship === "partial"
                            ? "partial"
                            : "covered"
                      }
                      tooltip={
                        theme.relationship === "emerging"
                          ? "This live theme adds materially new context that is not clearly represented in the baseline report."
                          : theme.relationship === "partial"
                            ? "This live theme overlaps with the baseline report, but adds more specificity or a distinct angle."
                            : "This live theme is already well represented in the baseline report."
                      }
                    >
                      {theme.relationship === "emerging"
                        ? "Emerging"
                        : theme.relationship === "partial"
                          ? "Partial"
                          : "Covered"}
                    </Badge>

                    <Badge
                      tone={
                        theme.sourceType === "noise_llm" ? "noise" : "cluster"
                      }
                      tooltip={
                        theme.sourceType === "noise_llm"
                          ? "An inferred live narrative pulled from noisier, lower-density conversation patterns that still appear strategically meaningful."
                          : "A structured live theme identified from clustered conversation data with clearer pattern consistency."
                      }
                    >
                      {theme.sourceType === "noise_llm"
                        ? "Emerging Narrative"
                        : "Structured Live Theme"}
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {theme.description}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/40">
                No live themes were returned for this response.
              </div>
            )}
          </div>

          {emergingNarratives.length ? (
            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                Emerging Narratives
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {emergingNarratives.map((item, idx) => (
                  <Badge
                    key={`${item}-${idx}`}
                    tone="emerging"
                    tooltip="A live narrative identified as materially new relative to the baseline report."
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      <RelevantCuratedInsights insights={curatedInsights} />

      <Panel
        title="What This Means"
        subtitle="Strategic synthesis for decision-making"
      >
        <p className="text-[15px] leading-7 text-white/80">
          {answer.whatThisMeans}
        </p>
      </Panel>

      <RecommendedActions actions={recommendedActions} />
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-3xl rounded-2xl rounded-br-md bg-white px-4 py-3 text-sm leading-6 text-black shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ responsePayload }) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-6xl rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <AssistantAnswer responsePayload={responsePayload} />
      </div>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
        Thinking…
      </div>
    </div>
  );
}

export default function WorkspaceShell() {
  const [therapeuticAreas, setTherapeuticAreas] = useState([]);
  const [therapeuticArea, setTherapeuticArea] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState("");

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    if (!query) return sessions;

    return sessions.filter((session) => {
      const title = (session.title || "").toLowerCase();
      const area = (session.therapeutic_area || "").toLowerCase();
      return title.includes(query) || area.includes(query);
    });
  }, [sessions, sessionSearch]);

  useEffect(() => {
    async function loadTherapeuticAreas() {
      try {
        setLoadingAreas(true);
        const res = await fetch("/api/therapeutic-areas");
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load therapeutic areas");
        }

        const areas = data.therapeuticAreas || [];
        setTherapeuticAreas(areas);

        if (areas.length > 0) {
          setTherapeuticArea((current) => {
            if (current && areas.includes(current)) return current;
            return areas[0];
          });
        }
      } catch (err) {
        setError(err?.message || "Failed to load therapeutic areas");
      } finally {
        setLoadingAreas(false);
      }
    }

    loadTherapeuticAreas();
  }, []);

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoadingSessions(true);
        const res = await fetch("/api/chat/sessions");
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load sessions");
        }

        setSessions(data.sessions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSessions(false);
      }
    }

    loadSessions();
  }, []);

  const canSubmit = useMemo(() => {
    return !!question.trim() && !!therapeuticArea && !loading;
  }, [question, therapeuticArea, loading]);

  function pushRecentQuestion(q) {
    setRecentQuestions((prev) => {
      const next = [q, ...prev.filter((item) => item !== q)];
      return next.slice(0, 8);
    });
  }

  function sortSessions(nextSessions) {
    return [...nextSessions].sort((a, b) => {
      const aPinned = a.is_pinned ? 1 : 0;
      const bPinned = b.is_pinned ? 1 : 0;

      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }

      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }

  async function createSession(firstQuestion) {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        therapeuticArea,
        firstQuestion,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to create session");
    }

    setSessions((prev) => sortSessions([data.session, ...prev]));
    setActiveSessionId(data.session.id);
    return data.session.id;
  }

  async function appendMessages(sessionId, newMessages) {
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        messages: newMessages,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to save messages");
    }
  }

  async function openSession(sessionId) {
    try {
      setError("");
      const res = await fetch(`/api/chat/session?sessionId=${sessionId}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to open session");
      }

      setActiveSessionId(sessionId);
      setEditingSessionId(null);
      setEditingTitle("");

      const restoredMessages = (data.messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        ...(message.role === "user"
          ? { text: message.content.text }
          : {
              responsePayload: {
                answer: message.content.answer,
                relevantCuratedInsights:
                  message.content.relevantCuratedInsights ||
                  message.content.curatedInsights ||
                  [],
              },
            }),
      }));

      setMessages(restoredMessages);
      setTherapeuticArea(data.session.therapeutic_area);
    } catch (err) {
      setError(err?.message || "Failed to open session");
    }
  }

  function startNewConversation() {
    setActiveSessionId(null);
    setMessages([]);
    setQuestion("");
    setError("");
    setEditingSessionId(null);
    setEditingTitle("");
  }

  function beginRename(session) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title || "");
  }

  function cancelRename() {
    setEditingSessionId(null);
    setEditingTitle("");
  }

  async function saveRename(sessionId) {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`/api/chat/session`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          title: trimmed,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to rename session");
      }

      setSessions((prev) =>
        sortSessions(
          prev.map((session) =>
            session.id === sessionId ? data.session : session
          )
        )
      );

      setEditingSessionId(null);
      setEditingTitle("");
    } catch (err) {
      setError(err?.message || "Failed to rename session");
    }
  }

  async function deleteSession(sessionId) {
    const confirmed = window.confirm(
      "Delete this conversation? This will remove the session and its messages."
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/chat/session?sessionId=${sessionId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete session");
      }

      setSessions((prev) => prev.filter((session) => session.id !== sessionId));

      if (activeSessionId === sessionId) {
        startNewConversation();
      }
    } catch (err) {
      setError(err?.message || "Failed to delete session");
    }
  }

  async function togglePinned(session) {
    try {
      const res = await fetch(`/api/chat/session`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.id,
          isPinned: !session.is_pinned,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update pin state");
      }

      setSessions((prev) =>
        sortSessions(
          prev.map((item) => (item.id === session.id ? data.session : item))
        )
      );
    } catch (err) {
      setError(err?.message || "Failed to update pin state");
    }
  }

  async function submitQuestion(rawQuestion) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || loading || !therapeuticArea) return;

    setError("");
    setLoading(true);
    pushRecentQuestion(trimmed);

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      let sessionId = activeSessionId;

      if (!sessionId) {
        sessionId = await createSession(trimmed);
      }

      await appendMessages(sessionId, [
        {
          role: "user",
          content: { text: trimmed },
        },
      ]);

      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmed,
          therapeuticArea,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate AskSocial answer");
      }

      const responsePayload = {
        answer: data.answer,
        relevantCuratedInsights: data.relevantCuratedInsights || [],
        debug: data.debug || {},
      };

      const assistantMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        responsePayload,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      await appendMessages(sessionId, [
        {
          role: "assistant",
          content: {
            answer: data.answer,
            relevantCuratedInsights: data.relevantCuratedInsights || [],
          },
        },
      ]);

      setSessions((prev) =>
        sortSessions(
          prev.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  updated_at: new Date().toISOString(),
                }
              : session
          )
        )
      );
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submitQuestion(question);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-[320px_1fr]">
        <aside className="border-r border-white/10 bg-black/80">
          <div className="flex h-full flex-col p-5">
            <div>
              <div className="text-2xl font-semibold tracking-tight">
                AskSocial
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/40">
                Workspace
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={startNewConversation}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90"
              >
                New conversation
              </button>
            </div>

            <div className="mt-8">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Therapeutic area
              </label>

              <select
                value={therapeuticArea}
                onChange={(e) => setTherapeuticArea(e.target.value)}
                disabled={loadingAreas || therapeuticAreas.length === 0}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 disabled:opacity-60"
              >
                {loadingAreas ? (
                  <option>Loading...</option>
                ) : therapeuticAreas.length === 0 ? (
                  <option>No therapeutic areas found</option>
                ) : (
                  therapeuticAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Quick actions
              </p>
              <div className="mt-3 space-y-2">
                {QUICK_ACTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submitQuestion(item)}
                    disabled={loading || !therapeuticArea}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/75 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Recent questions
              </p>
              <div className="mt-3 space-y-2">
                {recentQuestions.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/40">
                    Your recent questions will appear here.
                  </div>
                ) : (
                  recentQuestions.map((item, idx) => (
                    <button
                      key={`${item}-${idx}`}
                      type="button"
                      onClick={() => submitQuestion(item)}
                      disabled={loading || !therapeuticArea}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {item}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Conversations
                </p>
                <span className="text-[11px] text-white/30">
                  {filteredSessions.length} shown
                </span>
              </div>

              <div className="mt-3">
                <input
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/30"
                />
              </div>

              <div className="mt-3 space-y-2">
                {loadingSessions ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/40">
                    Loading conversations...
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/40">
                    {sessionSearch.trim()
                      ? "No conversations match your search."
                      : "No saved conversations yet."}
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        activeSessionId === session.id
                          ? "border-white/20 bg-white/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      {editingSessionId === session.id ? (
                        <div className="space-y-2">
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveRename(session.id)}
                              className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-black"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openSession(session.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-white">
                                {session.title || "Untitled conversation"}
                              </div>
                              {session.is_pinned ? (
                                <span
                                  title="Pinned conversation"
                                  className="text-xs text-amber-300"
                                >
                                  ★
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-white/40">
                              {session.therapeutic_area}
                            </div>
                            <div className="mt-1 text-[11px] text-white/30">
                              Updated {formatDate(session.updated_at)}
                            </div>
                          </button>

                          <div className="mt-3 flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => togglePinned(session)}
                              className="text-xs text-white/45 transition hover:text-white/70"
                            >
                              {session.is_pinned ? "Unpin" : "Pin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => beginRename(session)}
                              className="text-xs text-white/45 transition hover:text-white/70"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSession(session.id)}
                              className="text-xs text-rose-400/80 transition hover:text-rose-300"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                User
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">Signed in</p>
                  <p className="text-xs text-white/45">
                    Workspace access enabled
                  </p>
                </div>
                <UserButton />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <header className="border-b border-white/10 bg-black/70 px-6 py-5 backdrop-blur">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                AskSocial Workspace
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {activeSession?.title || "Conversational social intelligence"}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-white/60">
                {activeSession
                  ? `Working across ${activeSession.therapeutic_area}. Last updated ${formatDate(
                      activeSession.updated_at
                    )}.`
                  : "Ask questions across your baseline report themes and live narrative signals to understand what people are saying, what is changing, and what it means."}
              </p>
            </div>
          </header>

          <div className="flex-1 px-6 py-6">
            <section className="flex min-h-[520px] flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
              {messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Start with a question
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                      Ask about baseline themes, emerging narratives, changing
                      concerns, trust signals, country differences, platform
                      behavior, or what has shifted since the last report.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) =>
                  message.role === "user" ? (
                    <UserMessage key={message.id} text={message.text} />
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      responsePayload={message.responsePayload}
                    />
                  )
                )
              )}

              {loading ? <LoadingMessage /> : null}

              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}
            </section>
          </div>

          <div className="sticky bottom-0 border-t border-white/10 bg-black/95 px-6 py-4 backdrop-blur">
            <form onSubmit={handleSubmit}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Ask AskSocial
                  </label>

                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about country differences, personas, platform preferences, trust dynamics, barriers, or what changed since the last report..."
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-white/30"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-white/40">
                      Report-backed insights + structured curated intelligence +
                      live narrative discovery
                    </p>
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Analyzing..." : "Ask"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}