import { activityFetch, withActivity } from "./requestActivity";

export function getDownloadFileName(disposition: string | null, fallback = "download") {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="([^"]+)"|filename=([^;]+)/i);
  let fileName = plain?.[1] || plain?.[2]?.trim() || fallback;
  if (encoded) {
    try { fileName = decodeURIComponent(encoded); } catch { /* Use the plain name. */ }
  }
  return fileName.replace(/[\\/\u0000-\u001f\u007f]/g, "_");
}

export async function downloadFile(href: string, fallback?: string) {
  return withActivity(async () => {
    const response = await activityFetch(href, { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "The download could not be prepared. Please try again.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getDownloadFileName(response.headers.get("Content-Disposition"), fallback);
    document.body.appendChild(anchor);
    try { anchor.click(); } finally {
      anchor.remove();
      // Let the browser start consuming the object URL before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  });
}
