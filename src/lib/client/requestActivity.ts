// Shared by client request helpers and React's external-store subscriber.
// Track requests individually so one completion cannot hide another operation.
type ActivityOwner = () => () => void;
let activeOwner: ActivityOwner | undefined;

// Bind synchronous request starts and an action's entire returned promise to
// its control. Each action owns its counter, so concurrent buttons stay local.
export function runAction<T>(owner: ActivityOwner, operation: () => T): T {
  const previous = activeOwner;
  activeOwner = owner;
  try {
    const result = operation();
    if (result && typeof (result as { then?: unknown }).then === "function") {
      const finish = owner();
      Promise.resolve(result).then(finish, finish);
    }
    return result;
  } finally {
    activeOwner = previous;
  }
}

let pending = 0;
const listeners = new Set<() => void>();

export function getPendingActivity() {
  return pending;
}

export function subscribeToActivity(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function beginActivity() {
  const finishOwner = activeOwner?.();
  pending += 1;
  listeners.forEach(listener => listener());
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    finishOwner?.();
    pending -= 1;
    listeners.forEach(listener => listener());
  };
}

export async function withActivity<T>(operation: () => Promise<T>): Promise<T> {
  const finish = beginActivity();
  try {
    return await operation();
  } finally {
    finish();
  }
}

// Application endpoints return finite JSON or files. Include body transfer in
// the pending period, while leaving the caller's Response unread and intact.
// This is an explicit client helper; it never patches browser/Next/Clerk fetch.
export function activityFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return withActivity(async () => {
    const response = await globalThis.fetch(input, init);
    if (response.body) await response.clone().arrayBuffer();
    return response;
  });
}
