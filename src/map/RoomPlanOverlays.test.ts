import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CameraRegistration } from "../models/domain";
import { populateRoomPlanOverlays, roomPlanCameraOverlayPoints } from "./RoomPlanOverlays";

const registration: CameraRegistration = {
  status: "positioned",
  cameraId: "camera-1",
  mapId: "map-21",
  coordinateFrame: "roomplan-local",
  source: "visual-roomplan-registration",
  cameraToWorld: [
    [0, 0, -1, -2],
    [0, 1, 0, 1],
    [1, 0, 0, 3],
    [0, 0, 0, 1],
  ],
};

describe("RoomPlan camera overlays", () => {
  it("transforms the calibrated view points with the same row-major convention as iOS", () => {
    const overlay = roomPlanCameraOverlayPoints(registration);
    expect(overlay?.origin.toArray()).toEqual([-2, 1, 3]);
    expect(overlay?.corners[0].toArray()).toEqual([-1.38, 1.22, 2.66]);
    expect(overlay?.corners[2].toArray()).toEqual([-1.38, 0.78, 3.34]);
  });

  it("does not draw a camera calibration from another map revision", () => {
    const group = new THREE.Group();
    populateRoomPlanOverlays(group, [registration], [], "map-22", true);
    expect(group.children).toHaveLength(0);
  });
});
