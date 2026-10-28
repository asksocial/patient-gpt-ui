"use client";

import { useRouter } from "next/navigation";
import { ThemeMentionList } from "./ConversationThemeEvidence";

export default function ThemeEvidencePage(props) {
  const router = useRouter();
  return <div className="asksocial-v2"><main data-asksocial-workarea-content className="workspace-shell min-h-screen bg-[#071310] px-4 py-8 text-white"><div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-[#102722] p-6">
    <ThemeMentionList {...props} onBack={() => { if (window.history.length > 1) router.back(); else router.push("/workspace"); }} />
  </div></main></div>;
}
