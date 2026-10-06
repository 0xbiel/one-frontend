/** Save the server-sanitized export locally; no external upload or sharing. */
export function downloadPrivacyExport(value: unknown, homeId: string): void {
  if (!value || typeof value !== "object" || !("home_id" in value) || value.home_id !== homeId || !("data" in value) || !value.data || typeof value.data !== "object") {
    throw new Error("Export did not match the current household");
  }
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `one-household-${homeId}-export.json`;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // Keep the URL alive until the browser has begun the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
