"use client";

import { useEffect, useRef, useState } from "react";
import ActionButton from "./ui/ActionButton";

const steps = [
  ["Read the mention", "Check the full source wording, original source and timestamps. Detection scores and matched concepts help explain screening; they do not establish a reportable case."],
  ["Choose the next step", "Reclassify as Health Experience for a product-linked, non-AE safety observation; close a source-supported non-case as Not Reportable; or process a potential case with Structured Human Review. Selecting a path does not save a decision or start Day Zero."],
  ["Complete the supported evidence", "In Structured Human Review, confirm the product and event. Identify one specific patient using a supported ICH characteristic and evidence, then attest your check. Document the reporter’s identity, verified existence and first-hand knowledge separately."],
  ["Review the clinical details", "Check the product, event, severity, seriousness, outcome, duplicate assessment and follow-up needs. Keep missing information explicit. Save incomplete assessment retains your work without confirming reportability or sending anything."],
  ["Confirm the complete case", "When all four minimum ICSR criteria are supported, review the case summary and confirm completion. This governed action starts the applicable Day Zero clock and adds the approved case to Reviewed Cases & Email. Email composition, sending and client receipt are separate steps."],
];

export default function PvReviewHowTo() {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    const panel = dialog.current;
    if (open && !panel.open) panel.showModal();
    if (!open && panel.open) panel.close();
  }, [open]);
  return <>
    <ActionButton type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="rounded-xl border border-cyan-300/25 px-4 py-2.5 text-sm font-medium text-cyan-200">How To Guide</ActionButton>
    <dialog ref={dialog} aria-labelledby="pv-review-how-to-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-lg overflow-y-auto border-l border-white/15 bg-white p-6 text-[#0c2923] shadow-2xl backdrop:bg-black/60">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="pv-review-how-to-title" className="text-xl font-semibold">How to review a PV mention</h2><p className="mt-2 text-sm leading-6 text-white/55">Follow the evidence and choose the appropriate review path.</p></div>
        <ActionButton type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Close guide</ActionButton>
      </div>
      <ol className="mt-6 space-y-5">{steps.map(([title, detail], index) => <li key={title} className="rounded-xl border border-white/10 p-4"><p className="text-xs font-semibold text-cyan-200">Step {index + 1}</p><h3 className="mt-1 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{detail}</p></li>)}</ol>
      <p className="mt-6 text-xs leading-5 text-white/45">History &amp; Audit retains review decisions and provenance. Changing the visible path does not remove retained history or reset an existing clock.</p>
    </dialog>
  </>;
}
