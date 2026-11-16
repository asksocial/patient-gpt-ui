"use client";

import styles from "./AskStarters.module.css";

const ICON_PATHS = {
  baseline: "M4 6h16M4 12h12M4 18h7",
  emerging: "m3 17 6-6 4 4 8-10M15 5h6v6",
  concerns: "M12 20V4m-7 7 7-7 7 7",
  trust: "m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Z",
  countries: "M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  shifted: "M4 4v6h6M20 20v-6h-6M5 9a8 8 0 0 1 13-4M19 15A8 8 0 0 1 6 19",
};

export default function AskStarters({ starters, onChoose, disabled = false }) {
  return <div className={styles.emptyState}>
    {starters.length ? <><h2 className={styles.heading}>Start with one of these</h2>
      <div className={styles.grid}>{starters.map(item => <button type="button" key={item.id} className={styles.starter} onClick={() => onChoose(item.question)} disabled={disabled}>
        <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{item.id === "countries" ? <circle cx="12" cy="12" r="9" /> : null}<path d={ICON_PATHS[item.id]} /></svg></span>
        <span><span className={styles.category}>{item.category}</span><span className={styles.question}>{item.question}</span></span>
      </button>)}</div></> : null}
    <p className={styles.method}>{["Human conversations", "Evidence", "Patterns", "Intelligence", "Decisions"].map((step, index) => <span key={step}>{index ? <span className={styles.arrow} aria-hidden="true">→</span> : null}<span className={index === 4 ? styles.decision : undefined}>{step}</span></span>)}</p>
  </div>;
}
