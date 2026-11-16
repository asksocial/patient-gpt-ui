"use client";

import { useLayoutEffect } from "react";
import { ActionForm } from "./ui/ActionButton";
import styles from "./AskQueryCard.module.css";

export default function AskQueryCard({ empty, topic, updatedAt, question, onChange, onSubmit, canSubmit, textareaRef, questionMode = "new", children }) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const resize = () => { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [question, empty, textareaRef]);
  const input = <textarea ref={textareaRef} aria-label={questionMode === "follow_up" ? "Ask a follow-up" : "Intelligence question"} maxLength={2000} value={question} onChange={event => onChange(event.target.value)} placeholder={empty ? "Ask about themes, narratives, concerns, trust signals or country differences…" : "What would you like to understand about the conversation?"} rows={2} className={styles.textarea} />;
  return <ActionForm onSubmit={onSubmit}>
    <div className={`ask-query-card ${empty ? "ask-query-card-empty" : ""} ${styles.card}`}>
      <p className="ask-query-meta">{topic}{!empty && updatedAt ? ` · Updated ${updatedAt}` : ""}</p>
      {empty ? <><h1 className={styles.title}>What would you like to understand?</h1><p className={styles.subtitle}>Ask the governed evidence what is happening, why it matters, and where to investigate next.</p></> : null}
      {children}
      <div className={`ask-query-input-row ${styles.inputRow} ${empty ? styles.emptyInput : ""}`}>
        {empty ? <div className={styles.input}>{input}</div> : <h1 className={`ask-query-heading ${styles.input}`}>{input}</h1>}
        <button type="submit" disabled={!canSubmit} className={styles.explore}>Explore →</button>
      </div>
    </div>
  </ActionForm>;
}
