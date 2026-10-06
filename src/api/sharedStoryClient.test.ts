import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { sessionStorage.clear(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
it("reads persisted day story and care reminders through the authenticated household routes", async () => {
 vi.stubEnv("VITE_DEMO_MODE", "false"); vi.resetModules();
 sessionStorage.setItem("one_home_id", "home-a"); sessionStorage.setItem("one_access_token", "disposable-token");
 const fetched = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }); vi.stubGlobal("fetch", fetched);
 const { api } = await import("./client");
 await api.getDayStory("recipient-a", "Europe/Madrid"); await api.getCareEntries("recipient-a"); await api.getMedicationReminders("2026-10-01", undefined, "recipient-a");
 expect(fetched.mock.calls[0][0]).toContain("/homes/home-a/day-story?care_recipient_id=recipient-a&timezone_name=Europe%2FMadrid");
 expect(fetched.mock.calls[1][0]).toContain("/homes/home-a/care-entries?care_recipient_id=recipient-a");
 expect(fetched.mock.calls[2][0]).toContain("/medication-reminders?day=2026-10-01&care_recipient_id=recipient-a");
 expect(fetched.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer disposable-token");
});
