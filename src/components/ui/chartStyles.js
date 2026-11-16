export const DATA_RAMP = [1, 2, 3, 4, 5].map(rank => `var(--as-data-${rank})`);
export const OTHER_COLOR = "var(--as-data-other)";
export const formatShare = (count, total) => total ? Number((count / total * 100).toFixed(1)) : 0;
export const isOtherCategory = item => item.id === "remainder" || /^(other|unspecified|unknown)(\b|\s*\/)/i.test(item.label);
export const rankedCategories = segments => [...segments].filter(item => item.count > 0).sort((a, b) => Number(isOtherCategory(a)) - Number(isOtherCategory(b)) || b.count - a.count);
export const getRankColor = (index, total) => DATA_RAMP[index] || `color-mix(in srgb,var(--as-data-5) ${Math.max(15, 100 - (index - DATA_RAMP.length + 1) / Math.max(1, total - DATA_RAMP.length) * 70)}%,var(--as-card))`;
