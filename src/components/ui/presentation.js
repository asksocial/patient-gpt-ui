/** Presentation only: preserve acronyms while making interface labels sentence case. */
export function sentenceCaseLabel(value = "") {
  return value.split(/(\s+)/).map((word, index) => index === 0 || /^[A-Z\d/&-]+$/.test(word) ? word : word.split(/([/&-])/).map(part => /^[A-Z\d]+$/.test(part) ? part : part.toLowerCase()).join("")).join("")
    .replace(/\bexecutive brief\b/gi, "Executive Brief")
    .replace(/\bknowledge graph\b/gi, "Knowledge Graph")
    .replace(/\bmedical affairs\s*\/\s*heor\b/gi, "Medical Affairs/HEOR");
}

/** Navigation, tab and category labels use Title Case; descriptions remain prose. */
export function titleCaseLabel(value = "") {
  const acronyms = { heor: "HEOR", pv: "PV", qa: "QA", ae: "AE", adr: "ADR", icsr: "ICSR", odcs: "ODCS", api: "API", ai: "AI", hcp: "HCP", pdf: "PDF", csv: "CSV", glp: "GLP", e2b: "E2B", r3: "R3" };
  return value.replace(/[A-Za-z][A-Za-z0-9]*/g, word => acronyms[word.toLowerCase()] || (/^[A-Z0-9]+$/.test(word) || /[a-z][A-Z]/.test(word) ? word : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .replace(/Medical Affairs\s*\/\s*HEOR/g, "Medical Affairs/HEOR");
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
