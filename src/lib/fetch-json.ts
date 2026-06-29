/** Safe JSON fetch — avoids "Unexpected token '<'" when server returns HTML error pages. */
export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error(
        "Report API not found (404). Redeploy the latest app on Hostinger, then restart the Node.js app."
      );
    }
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(
        res.status >= 500
          ? `Server error (${res.status}). Check Hostinger logs or restart the app — the request may have timed out during AI generation.`
          : `Server returned a web page instead of JSON (${res.status}). Redeploy and restart the app on Hostinger.`
      );
    }
    throw new Error(text.slice(0, 200) || `Unexpected response (${res.status})`);
  }

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}
