import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalCameraPreview } from "./LocalCameraPreview";

afterEach(() => vi.restoreAllMocks());

describe("local camera preview", () => {
  it("opens the selected computer camera and stops its track when leaving the page", async () => {
    const stop = vi.fn();
    const track = { stop, addEventListener: vi.fn() };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "usb-1", label: "USB camera" }]);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia, enumerateDevices, addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    const view = render(<LocalCameraPreview />);
    await waitFor(() => expect(screen.getByRole("option", { name: "USB camera" })).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "usb-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Conectar cámara" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ video: { deviceId: { exact: "usb-1" } }, audio: false }));
    await waitFor(() => expect(screen.getByText("● En directo")).toBeInTheDocument());
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
