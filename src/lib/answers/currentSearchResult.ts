type SearchMessage = { role: string; text?: string };

/** Search is one replaceable result view over persisted conversation history.
 * A newly submitted question must never show an older question's response. */
export function getCurrentSearchResult<T extends SearchMessage>(messages: readonly T[]): { question: string; message: T | null } {
  let response: T | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") return { question: message.text || "", message: response };
    if (message.role === "assistant" && !response) response = message;
  }
  return { question: "", message: response };
}
