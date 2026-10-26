// Shared by client request helpers and React's external-store subscriber.
// Track requests individually so one completion cannot hide another operation.
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
  pending += 1;
  listeners.forEach(listener => listener());
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
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
