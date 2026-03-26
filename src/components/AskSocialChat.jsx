"use client";

import { useState } from "react";

const STARTER_QUESTIONS = [
  "What are people saying right now?",
  "What’s emerging in live conversation beyond the report baseline?",
  "What themes are driving confusion or concern?",
  "What’s changed since the last report?",
];

function Badge({ children, tone = "default" }) {
  const styles = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    emerging: "bg-amber-50 text-amber-800 border-amber-200",
    partial: "bg-blue-50 text-blue-800 border-blue-200",
    covered: "bg-emerald-50 text-emerald-800 border-emerald-200",
    cluster: "bg-violet-50 text-violet-800 border-violet-200",
    noise: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.default}`}
    >
      {children}
    </span>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function AssistantAnswer({ answer }) {
  const curatedThemes = answer?.curatedIntelligence?.themes || [];
  const liveThemes = answer?.liveData?.themes || [];
  const emergingNarratives = answer?.liveData?.emergingNarratives || [];

  return (
    <div className="space-y-4">
      <Card
        title="Direct Answer"
        subtitle="Report-backed, live-enhanced summary"
      >
        <p className="text-[15px] leading-7 text-slate-700">
          {answer?.directAnswer}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="From Curated Intelligence"
          subtitle="Baseline themes from existing reports"
        >
          <div className="space-y-4">
            {curatedThemes.map((theme, idx) => (
              <div
                key={`${theme.name}-${idx}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <h4 className="text-sm font-semibold text-slate-900">
                  {theme.name}
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {theme.description}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="What’s Emerging in Live Data"
          subtitle={
            emergingNarratives.length
              ? `${emergingNarratives.length} emerging narrative${emergingNarratives.length > 1 ? "s" : ""} detected`
              : "Live themes aligned to the baseline"
          }
        >
          <div className="space-y-4">
            {liveThemes.map((theme, idx) => (
              <div
                key={`${theme.name}-${idx}`}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
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
                  >
                    {theme.relationship}
                  </Badge>

                  <Badge
                    tone={
                      theme.sourceType === "noise_llm" ? "noise" : "cluster"
                    }
                  >
                    {theme.sourceType === "noise_llm"
                      ? "Emerging narrative"
                      : "Structured live theme"}
                  </Badge>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {theme.description}
                </p>
              </div>
            ))}
          </div>

          {emergingNarratives.length ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Emerging narratives
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {emergingNarratives.map((item, idx) => (
                  <Badge key={`${item}-${idx}`} tone="emerging">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card
        title="What This Means"
        subtitle="Strategic synthesis for decision-making"
      >
        <p className="text-[15px] leading-7 text-slate-700">
          {answer?.whatThisMeans}
        </p>
      </Card>
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-3xl rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ answer }) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-5xl rounded-3xl rounded-bl-md border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <AssistantAnswer answer={answer} />
      </div>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        Thinking…
      </div>
    </div>
  );
}

export default function AskSocialChat() {
  const [therapeuticArea, setTherapeuticArea] = useState("Hepatitis B");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitQuestion(rawQuestion) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || loading) return;

    setError("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-user`,
        role: "user",
        text: trimmed,
      },
    ]);

    setQuestion("");

    try {
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

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          answer: data.answer,
        },
      ]);
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
    <div className="bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                AskSocial
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Social intelligence, made conversational
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Ask natural-language questions and get a baseline report view
                enriched with live emerging narratives, trust signals, and
                strategic synthesis.
              </p>
            </div>

            <div className="w-full max-w-sm">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Therapeutic area
              </label>
              <select
                value={therapeuticArea}
                onChange={(e) => setTherapeuticArea(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-500"
              >
                <option>Hepatitis B</option>
              </select>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => submitQuestion(item)}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="flex min-h-[420px] flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-100/60 p-4 md:p-5">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Start with a question
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Ask about the report baseline, emerging narratives, changing
                  concerns, trust signals, or what’s shifted since the last
                  report.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <UserMessage key={message.id} text={message.text} />
              ) : (
                <AssistantMessage key={message.id} answer={message.answer} />
              )
            )
          )}

          {loading ? <LoadingMessage /> : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <form
          onSubmit={handleSubmit}
          className="sticky bottom-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60"
        >
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ask AskSocial
            </label>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about baseline themes, emerging narratives, trust dynamics, or what changed since the last report..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-500"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Report-backed insights + live narrative discovery
              </p>
              <button
                type="submit"
                disabled={!question.trim() || loading}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Ask"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}