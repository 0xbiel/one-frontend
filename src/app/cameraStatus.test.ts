import { expect, it } from "vitest";
import type { Device } from "../models/domain";
import { cameraStatus } from "./cameraStatus";
const camera: Device = { id: "camera", label: "Camera", platform: "test", status: "offline", lastSeenAt: "now", simulation: { data_origin: "simulated", status: "simulated_online", label: "Simulated online", real_capture: false, ready: false } };
it("uses explicit simulated availability while preserving physical offline metadata", () => {
 expect(cameraStatus(camera)).toEqual({ label: "Online", online: true, simulated: true });
 expect(camera.status).toBe("offline");
 expect(cameraStatus({ ...camera, simulation: undefined })).toEqual({ label: "offline", online: false, simulated: false });
 expect(cameraStatus({ ...camera, simulation: { ...camera.simulation!, status: "simulated_offline" } }).online).toBe(false);
});
