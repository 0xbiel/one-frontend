import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalCameraGallery } from "./LocalCameraGallery";

afterEach(() => vi.restoreAllMocks());

describe("camera gallery", () => {
  it("shows a real selected camera in the original gallery slots and stops it on exit", async () => {
    const stop = vi.fn();
    const track = { stop, getSettings: () => ({ deviceId: "usb-1" }), addEventListener: vi.fn() };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "usb-1", label: "USB camera" }]);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia, enumerateDevices, addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    const view = render(<LocalCameraGallery />);
    await waitFor(() => expect(screen.getByText("1 detectadas · 0 en directo")).toBeInTheDocument());
    expect(screen.getByText("La cámara aparecerá aquí")).toBeInTheDocument();
    expect(document.querySelector(".dd-local-gallery img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /conectar cámara/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ video: { deviceId: { exact: "usb-1" } }, audio: false }));
    await waitFor(() => expect(screen.getByText("1 detectadas · 1 en directo")).toBeInTheDocument());
    expect(screen.getAllByLabelText("Imagen en directo de USB camera")).toHaveLength(2);
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
