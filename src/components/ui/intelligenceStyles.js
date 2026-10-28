// Shared by Executive Brief priority pills and module confidence pills.
export const PRIORITY_STYLES = {
  high: "bg-rose-500/15 text-rose-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-white/10 text-white/55",
};

export const CONFIDENCE_STYLES = {
  high: PRIORITY_STYLES.high,
  medium: PRIORITY_STYLES.medium,
  moderate: PRIORITY_STYLES.medium,
  directional: PRIORITY_STYLES.low,
  insufficient: PRIORITY_STYLES.low,
};
