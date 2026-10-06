import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import type { Session } from "../models/domain";
import { PrivacyPage } from "./privacy";
import { downloadPrivacyExport } from "./privacyExport";

vi.mock("../api/client", () => ({ api: { exportData: vi.fn(), deleteData: vi.fn() } }));
const id = "11111111-1111-4111-8111-111111111111";
const session: Session = { actor: { id: "user", name: "Owner", role: "admin" }, home: { id, name: "Disposable home", residentName: "Recipient" } };
const exported = { home_id: id, exported_at: "2026-10-01", data: { care_recipients: [{ id: "recipient", home_id: id }] }, exclusions: { media: "Bytes excluded" } };
function show(role: Session["actor"]["role"] = "admin") {
  return render(<PrivacyPage session={{ ...session, actor: { ...session.actor, role } }} paused={false} onTogglePause={vi.fn()} consents={[]} setConsents={vi.fn()} />);
}

describe("Privacy export and explicit household deletion", () => {
  beforeEach(() => { vi.mocked(api.exportData).mockResolvedValue(exported); vi.mocked(api.deleteData).mockResolvedValue({ status: "completed" }); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  it("cancel closes typed confirmation without submitting deletion", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /request deletion/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Household ID"), { target: { value: id } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.deleteData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /request deletion/i }));
    expect(screen.getByLabelText("Household ID")).toHaveValue("");
  });

  it("rejects mismatched IDs and sends exact explicit confirmation only", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /request deletion/i }));
    const submit = screen.getByRole("button", { name: /permanently delete household/i });
    fireEvent.change(screen.getByLabelText("Household ID"), { target: { value: "wrong-home" } });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(api.deleteData).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Household ID"), { target: { value: id } });
    fireEvent.click(submit);
    await waitFor(() => expect(api.deleteData).toHaveBeenCalledWith({ confirmed: true, confirmation_home_id: id }));
    expect(api.deleteData).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("disables owner actions for caregivers", () => {
    show("caregiver");
    expect(screen.getByRole("button", { name: /download json/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /request deletion/i })).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("Only the household owner");
    expect(api.deleteData).not.toHaveBeenCalled();
  });

  it("starts a local JSON download containing the server export", async () => {
    const create = vi.fn().mockReturnValue("blob:local-export");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
    let filename = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    show();
    fireEvent.click(screen.getByRole("button", { name: /download json/i }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(JSON.parse(text)).toEqual(exported);
    expect(filename).toBe(`one-household-${id}-export.json`);
    expect(api.deleteData).not.toHaveBeenCalled();
  });

  it("shows export failure and rejects cross-household downloads", async () => {
    vi.mocked(api.exportData).mockRejectedValue(new Error("API_403"));
    show();
    fireEvent.click(screen.getByRole("button", { name: /download json/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not be downloaded"));
    expect(() => downloadPrivacyExport({ ...exported, home_id: "other" }, id)).toThrow("current household");
  });
});
