// Tab-scoped research results only. PV assessments and approval state never enter this cache.
export const RETAINED_MODULES = ["medical_affairs", "patient", "clinical_trials", "corporate_affairs", "commercial", "competitive", "advocacy"];
export type RetainedAnalysis = { moduleId: string; therapeuticArea: string; workspaceId: string; result: any };
export type WorkspaceContext = { therapeuticArea: string; moduleId: string; destination: string; workspaceId: string; sessionId: string | null; savedProductId?: string; question?: string };
type Store = { version: 1; context?: WorkspaceContext; analyses: RetainedAnalysis[] };
type StorageLike = Pick<Storage, "getItem" | "setItem">;
const memory = new Map<string, Store>();
const listeners = new Map<string, Set<() => void>>();
export function subscribeRetainedWork(scope: string, listener: () => void) {
  const scoped = listeners.get(scope) || new Set<() => void>();
  listeners.set(scope, scoped); scoped.add(listener);
  return () => { scoped.delete(listener); };
}
const storageKey = (scope: string) => `asksocial.research-session.v1:${scope}`;
function storage(): StorageLike | undefined { try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; } }
function read(scope: string, target = storage()): Store {
  if (!scope) return { version: 1, analyses: [] };
  if (memory.has(scope)) return memory.get(scope)!;
  try {
    const raw = target?.getItem(storageKey(scope));
    if (raw) { const data = JSON.parse(raw); if (data.version === 1 && Array.isArray(data.analyses)) { memory.set(scope, data); return data; } }
  } catch { /* Corrupt or unavailable browser storage must not prevent research. */ }
  return memory.get(scope) || { version: 1, analyses: [] };
}
function write(scope: string, value: Store, target = storage()) {
  if (!scope) return false;
  // Keep the most recent research views within a bounded tab-storage budget.
  value.analyses = value.analyses.slice(-12);
  memory.set(scope, value);
  listeners.get(scope)?.forEach(listener => listener());
  const bounded = { ...value, analyses: [...value.analyses] };
  while (JSON.stringify(bounded).length > 2_000_000 && bounded.analyses.length) bounded.analyses.shift();
  try { if (!target) return false; target.setItem(storageKey(scope), JSON.stringify(bounded)); return bounded.analyses.length === value.analyses.length; } catch { return false; }
}
export function readWorkspaceContext(scope: string, target?: StorageLike) { return read(scope, target).context; }
export function retainWorkspaceContext(scope: string, context: WorkspaceContext, target?: StorageLike) {
  return write(scope, { ...read(scope, target), context }, target);
}
export function analysisKey(moduleId: string, therapeuticArea: string, workspaceId = "") { return JSON.stringify([moduleId, therapeuticArea, workspaceId]); }
export function readRetainedAnalyses(scope: string, target?: StorageLike) {
  return read(scope, target).analyses.filter(item => item && RETAINED_MODULES.includes(item.moduleId) && item.therapeuticArea && item.result);
}
export function retainAnalysis(scope: string, analysis: RetainedAnalysis, target?: StorageLike) {
  if (!RETAINED_MODULES.includes(analysis.moduleId) || !analysis.therapeuticArea || !analysis.result) return false;
  const key = analysisKey(analysis.moduleId, analysis.therapeuticArea, analysis.workspaceId);
  const current = read(scope, target);
  return write(scope, { ...current, analyses: [...current.analyses.filter(item => analysisKey(item.moduleId, item.therapeuticArea, item.workspaceId) !== key), analysis] }, target);
}
export function restoreWorkspaceContext(context: WorkspaceContext | undefined, areas: string[], moduleIds: string[], workspaceIds: string[], sessionIds: string[], destinations: string[]): WorkspaceContext | null {
  if (!context || typeof context.destination !== "string" || !areas.includes(context.therapeuticArea)) return null;
  const moduleId = moduleIds.includes(context.moduleId) ? context.moduleId : "";
  const destination = context.destination.startsWith("module_")
    ? context.destination === `module_${moduleId}` && moduleId ? context.destination : "ask"
    : destinations.includes(context.destination) ? context.destination : "ask";
  const workspaceId = workspaceIds.includes(context.workspaceId) ? context.workspaceId : "";
  return { ...context, moduleId, destination, workspaceId, sessionId: sessionIds.includes(context.sessionId || "") ? context.sessionId : null, savedProductId: workspaceId ? context.savedProductId : undefined };
}
