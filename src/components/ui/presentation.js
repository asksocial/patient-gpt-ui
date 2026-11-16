/** Presentation only: preserve acronyms while making interface labels sentence case. */
export function sentenceCaseLabel(value = "") {
  return value.split(/(\s+)/).map((word, index) => index === 0 || /^[A-Z\d/&-]+$/.test(word) ? word : word.toLowerCase()).join("");
}

/** Native button activation keeps each existing tab's action as its sole handler. */
export function handleTabKeys(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')];
  const current = tabs.indexOf(event.target.closest('[role="tab"]'));
  if (current < 0 || !tabs.length) return;
  event.preventDefault();
  const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[index].focus();
  tabs[index].click();
}
