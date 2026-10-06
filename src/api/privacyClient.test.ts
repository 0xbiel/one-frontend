import { afterEach, describe, expect, it, vi } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
describe("Privacy deletion request contract", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); sessionStorage.clear(); });
  it("rejects mismatch before fetch and sends true plus the exact current home", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "completed", request_id: "disposable" }) });
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem("one_home_id", id);
    const { api } = await import("./client");
    await expect(api.deleteData({ confirmed: true, confirmation_home_id: "other" })).rejects.toThrow("current household");
    await expect(api.deleteData({ confirmed: false, confirmation_home_id: id } as never)).rejects.toThrow("current household");
    expect(fetchMock).not.toHaveBeenCalled();
    await api.deleteData({ confirmed: true, confirmation_home_id: id });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/homes/${id}/privacy/delete`);
    expect(JSON.parse(init.body)).toEqual({ confirmed: true, confirmation_home_id: id });
  });
});
