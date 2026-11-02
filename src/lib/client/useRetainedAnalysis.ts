"use client";
import { useCallback, useState, useSyncExternalStore } from "react";
import { analysisKey, readRetainedAnalyses, retainAnalysis, subscribeRetainedWork } from "./workspaceRetention";

export default function useRetainedAnalysis(scope: string, moduleId: string, therapeuticArea: string, workspaceId = "") {
  const key = analysisKey(moduleId, therapeuticArea, workspaceId);
  const subscribe = useCallback((listener: () => void) => subscribeRetainedWork(scope, listener), [scope]);
  const getSnapshot = useCallback(() => readRetainedAnalyses(scope).find(item => analysisKey(item.moduleId, item.therapeuticArea, item.workspaceId) === key)?.result || null, [scope, key]);
  const result = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [warning, setWarning] = useState({ key: "", text: "" });
  const setResult = useCallback((value: any) => {
    const retained = retainAnalysis(scope, { moduleId, therapeuticArea, workspaceId, result: value });
    setWarning({ key: `${scope}:${key}`, text: retained ? "" : "Browser refresh storage is unavailable or full. Save this work to a workspace to retain it." });
  }, [key, scope, moduleId, therapeuticArea, workspaceId]);
  return [result, setResult, warning.key === `${scope}:${key}` ? warning.text : ""] as const;
}
