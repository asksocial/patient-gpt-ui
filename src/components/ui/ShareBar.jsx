import { getRankColor } from "./chartStyles";
export default function ShareBar({ value, label, relativeTo = 100, rank = 0 }) {
  if (!Number.isFinite(value)) return null;
  const width = Math.max(0, Math.min(100, relativeTo ? value / relativeTo * 100 : 0));
  return <span className="as-share-track" role="img" aria-label={`${label}: ${value}%`}><span style={{ width: `${width}%`, background: getRankColor(rank, 5) }} /></span>;
}
