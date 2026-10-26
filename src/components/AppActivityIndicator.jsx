"use client";

import { useEffect, useSyncExternalStore } from "react";
import { beginActivity, getPendingActivity, subscribeToActivity } from "../lib/client/requestActivity";
import { ActivityNotice } from "./ui/Spinner";

const getServerSnapshot = () => 0;

// Keep multi-request actions visible throughout the whole operation as well.
export function useActivity(pending) {
  useEffect(() => {
    if (pending) return beginActivity();
  }, [pending]);
}

export default function AppActivityIndicator() {
  const pending = useSyncExternalStore(subscribeToActivity, getPendingActivity, getServerSnapshot);
  return pending > 0 ? <ActivityNotice /> : null;
}
