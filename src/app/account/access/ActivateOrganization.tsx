"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";

export function ActivateOrganization({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const { isLoaded, setActive } = useOrganizationList();
  const [message, setMessage] = useState("");

  async function activate() {
    if (!setActive) return;
    try {
      setMessage("Opening organization…");
      await setActive({ organization: organizationId });
      router.replace("/workspace");
      router.refresh();
    } catch {
      setMessage("Your organization could not be opened. Sign in again or contact your administrator.");
    }
  }

  return (
    <>
      <button className="rounded-lg bg-[var(--as-primary)] px-4 py-2 text-white" disabled={!isLoaded} onClick={activate}>
        Open organization
      </button>
      <p role="status" className="mt-3">{message}</p>
    </>
  );
}
