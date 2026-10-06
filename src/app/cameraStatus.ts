import type { Device } from "../models/domain";
/** Display simulated availability only when the server explicitly supplies it. */
export function cameraStatus(camera: Device | null | undefined): { label: string; online: boolean; simulated: boolean } {
 if (!camera) return { label: "Not paired", online: false, simulated: false };
 const simulated = camera.simulation?.data_origin === "simulated";
 const online = simulated ? camera.simulation?.status === "simulated_online" : camera.status === "online";
 return { label: simulated ? online ? "Online" : "Offline" : camera.status, online, simulated };
}
