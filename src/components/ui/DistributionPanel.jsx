import styles from "./Charts.module.css";
import { formatShare as percent, isOtherCategory as isOther, rankedCategories as ranked, getRankColor as rankColor, OTHER_COLOR as OTHER } from "./chartStyles";

/** Both market and audience distributions share scale, ordering and accessibility. */
export default function DistributionPanel({ title, subtitle, chart, concentrationNote, zeroGroups = [], footer }) {
  const segments = ranked(chart.segments);
  const leader = segments.find(item => !isOther(item)) || segments[0];
  if (!leader || !chart.denominator) return null;
  const share = percent(leader.count, chart.denominator);
  const label = segments.map(item => `${item.label}: ${percent(item.count, chart.denominator)}%`).join("; ");
  return <section className={styles.card}>
    <h3>{title}</h3><p className={styles.subtitle}>{subtitle}</p>
    <div className={styles.headline}><strong>{share}%</strong><span>{leader.label}</span></div>
    <div className={styles.stacked} role="img" aria-label={`${title}. ${label}`}>
      {segments.map((item, index) => <span key={item.id} style={{ width: `${item.count / chart.denominator * 100}%`, background: isOther(item) ? OTHER : rankColor(index, segments.length) }} />)}
    </div>
    <ul className={styles.legend}>{segments.map((item, index) => <li key={item.id}>
      <span className={styles.swatch} style={{ background: isOther(item) ? OTHER : rankColor(index, segments.length) }} aria-hidden="true" />
      <span>{item.label}</span><strong>{percent(item.count, chart.denominator)}%</strong>
    </li>)}</ul>
    {leader.count / chart.denominator >= 0.6 ? <p className={styles.callout}>{concentrationNote}</p> : null}
    {zeroGroups.length ? <div className={styles.zeroGroups}><p>No matching records from</p><div>{zeroGroups.map(item => <span key={item.id}>{item.label}</span>)}</div></div> : null}
    {footer ? <a className={styles.footer} href="#persona-breakdown">See persona breakdown ↓</a> : null}
  </section>;
}
