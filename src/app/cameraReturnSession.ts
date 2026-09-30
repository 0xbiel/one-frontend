const returnSessionKey = "one_camera_dashboard_return";
const sessionKeys = ["one_access_token", "one_home_id", "one_user_id"] as const;

export function rememberDashboardSession(): void {
  sessionStorage.removeItem(returnSessionKey);
  const accessToken = sessionStorage.getItem("one_access_token");
  if (!accessToken) return;
  const snapshot = Object.fromEntries(sessionKeys.map((key) => [key, sessionStorage.getItem(key)]));
  sessionStorage.setItem(returnSessionKey, JSON.stringify(snapshot));
}

export function restoreDashboardSession(): boolean {
  const saved = sessionStorage.getItem(returnSessionKey);
  sessionStorage.removeItem(returnSessionKey);
  if (!saved) return false;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || !("one_access_token" in parsed) || typeof parsed.one_access_token !== "string") return false;
    const snapshot = parsed as Record<string, unknown>;
    for (const key of sessionKeys) {
      const value = key in snapshot ? snapshot[key] : null;
      if (typeof value === "string") sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
