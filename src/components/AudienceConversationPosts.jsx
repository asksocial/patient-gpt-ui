"use client";

import { useEffect, useRef, useState } from "react";
import { activityFetch } from "../lib/client/requestActivity";
import styles from "./PersonaIntelligencePanel.module.css";

export default function AudienceConversationPosts({ context, group, selection, onClose }) {
  const panel = useRef(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: "start" }); panel.current?.focus({ preventScroll: true }); }, []);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ ...context, group: group.id, conversationType: selection.id, role: selection.role || "", page: String(page) });
    activityFetch(`/api/intelligence/conversations?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Posts could not be loaded.");
        if (active) setResult(data.evidence);
      }).catch(error => { if (active && error.name !== "AbortError") setError(error.message); });
    return () => { active = false; controller.abort(); };
  }, [context, group.id, selection.id, selection.role, page, attempt]);
  const changePage = next => { setResult(null); setError(""); setPage(next); panel.current?.scrollIntoView({ block: "start" }); panel.current?.focus({ preventScroll: true }); };
  return <section ref={panel} tabIndex={-1} className={styles.evidence} aria-label={`${group.label}: ${selection.label} posts`}>
    <div className={styles.evidenceHeading}><h4>{selection.label}</h4><button type="button" className={styles.conversationLink} onClick={onClose}>Close posts</button></div>
    <p>{group.label}{selection.roleLabel ? ` · ${selection.roleLabel}` : ""} · {context.question ? "Matching the current question" : "Full corpus"}</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" className={styles.conversationLink} onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry posts</button></div> : !result ? <p role="status">Loading posts…</p> : <>
      <p role="status">{result.total.toLocaleString()} matching posts · Page {result.page} of {result.pages}</p>
      {!result.total ? <p>No posts match this conversation type in this audience and question.</p> : <ul className={styles.postList}>{result.items.map(item => <li key={item.id}>
        <p className={styles.postMeta}>{[item.platform, item.country].filter(Boolean).join(" · ")}</p>
        <p className={styles.postText}>{item.text}</p>
        {item.url ? <a className={styles.conversationLink} href={item.url} target="_blank" rel="noreferrer">Open original source ↗</a> : <p>Original source URL unavailable.</p>}
      </li>)}</ul>}
      <div className={styles.pagination}><button type="button" disabled={result.page <= 1} onClick={() => changePage(result.page - 1)}>Previous posts</button><button type="button" disabled={result.page >= result.pages} onClick={() => changePage(result.page + 1)}>Next posts</button></div>
    </>}
  </section>;
}
