import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CameraRegistration, LastSeenObject } from "../models/domain";
import {
  populateRoomPlanOverlays,
  roomPlanCameraIdFromObject,
  roomPlanCameraIdsCoveringPoint,
  roomPlanCameraOverlayPoints,
  roomPlanSourceCameraIdFromObject,
  roomPlanWorldPointFromObject,
} from "./RoomPlanOverlays";

const registration: CameraRegistration = {
  status: "positioned",
  cameraId: "camera-1",
  mapId: "map-21",
  coordinateFrame: "roomplan-local",
  source: "visual-roomplan-registration",
  intrinsics: {
    matrix: [
      [640, 0, 320],
      [0, 640, 180],
      [0, 0, 1],
    ],
  },
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
    expect(overlay?.fovDegrees).toBeCloseTo(53.1301, 3);
    expect(overlay?.corners[0].toArray()).toEqual([-1.38, 1.174375, 2.69]);
    expect(overlay?.corners[2].toArray()).toEqual([-1.38, 0.825625, 3.31]);
  });

  it("uses an explicit horizontal FOV without inventing a vertical FOV", () => {
    const overlay = roomPlanCameraOverlayPoints({
      ...registration,
      intrinsics: { fov_degrees: 96 },
    });
    expect(overlay?.fovDegrees).toBe(96);
    expect(overlay?.corners).toHaveLength(2);
  });

  it("keeps the camera marker but omits a frustum when calibration has no FOV", () => {
    const group = new THREE.Group();
    populateRoomPlanOverlays(group, [{ ...registration, intrinsics: undefined }], [], "map-21", true);
    expect(group.children).toHaveLength(1);
    expect(group.children[0].children).toHaveLength(2);
  });

  it("makes a registered camera discoverable from any raycast child", () => {
    const group = new THREE.Group();
    populateRoomPlanOverlays(group, [registration], [], "map-21", true);
    const cameraGroup = group.children[0];
    const nestedMarker = cameraGroup.children[0];
    expect(cameraGroup.userData.oneCameraId).toBe("camera-1");
    expect(roomPlanCameraIdFromObject(nestedMarker)).toBe("camera-1");
  });

  it("does not draw a camera calibration from another map revision", () => {
    const group = new THREE.Group();
    populateRoomPlanOverlays(group, [registration], [], "map-22", true);
    expect(group.children).toHaveLength(0);
  });

  it("finds the calibrated cameras whose top-down FOV covers a selected room point", () => {
    const frontCamera: CameraRegistration = {
      ...registration,
      cameraId: "camera-front",
      intrinsics: { fov_degrees: 60 },
      cameraToWorld: [
        [1, 0, 0, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };
    const sideCamera: CameraRegistration = {
      ...frontCamera,
      cameraId: "camera-side",
      cameraToWorld: [
        [0, 0, -1, -2],
        [0, 1, 0, 1],
        [1, 0, 0, -2],
        [0, 0, 0, 1],
      ],
    };
    expect(roomPlanCameraIdsCoveringPoint([frontCamera, sideCamera], "map-21", { x: 0, y: 0, z: -2 })).toContain("camera-front");
    expect(roomPlanCameraIdsCoveringPoint([frontCamera], "map-21", { x: 2, y: 0, z: -1 })).toEqual([]);
    expect(roomPlanCameraIdsCoveringPoint([{ ...frontCamera, mapId: "map-old" }], "map-21", { x: 0, y: 0, z: -2 })).toEqual([]);
  });

  it("renders a recent anonymous person as a faded last-known dot", () => {
    const group = new THREE.Group();
    const person: LastSeenObject = {
      id: "person-1", label: "person", icon: "P", status: "seen", lastSeenAt: new Date().toISOString(),
      point: null, worldPoint: { x: 1, y: 0, z: 2 }, mapId: "map-21", cameraId: "camera-1",
      presenceState: "recent", confidenceRadiusM: 0.2, confidence: 0.9, zone: null, sourceEventId: null,
    };
    populateRoomPlanOverlays(group, [], [person], "map-21", false);
    expect(group.children).toHaveLength(1);
    expect(group.children[0].userData.onePresenceState).toBe("recent");
    expect(roomPlanWorldPointFromObject(group.children[0].children[0])?.toArray()).toEqual([1, 0, 2]);
    expect(roomPlanSourceCameraIdFromObject(group.children[0].children[0])).toBe("camera-1");
  });

  it("keeps only the newest room location for the same anonymous person", () => {
    const group = new THREE.Group();
    const oldObservation: LastSeenObject = {
      id: "person-1", label: "person", icon: "P", status: "seen", lastSeenAt: "2026-09-16T19:00:00Z",
      point: null, worldPoint: { x: 1, y: 0, z: 1 }, mapId: "map-old", cameraId: "camera-a",
      presenceState: "recent", confidenceRadiusM: 0.2, confidence: 0.9, zone: null, sourceEventId: null,
    };
    const newObservation: LastSeenObject = {
      ...oldObservation,
      lastSeenAt: "2026-09-16T19:00:05Z",
      worldPoint: { x: 3, y: 0, z: 4 },
      mapId: "map-21",
      cameraId: "camera-b",
      presenceState: "current",
    };
    populateRoomPlanOverlays(group, [], [oldObservation, newObservation], "map-21", false);
    expect(group.children).toHaveLength(1);
    expect(group.children[0].position.toArray()).toEqual([3, 0, 4]);
    expect(group.children[0].userData.onePresenceState).toBe("current");
  });

  it("does not render stale person presence", () => {
    const group = new THREE.Group();
    const person: LastSeenObject = {
      id: "person-2", label: "person", icon: "P", status: "seen", lastSeenAt: new Date().toISOString(),
      point: null, worldPoint: { x: 0, y: 0, z: 0 }, mapId: "map-21", cameraId: "camera-1",
      presenceState: "stale", confidenceRadiusM: 0.2, confidence: 0.9, zone: null, sourceEventId: null,
    };
    populateRoomPlanOverlays(group, [], [person], "map-21", true);
    expect(group.children).toHaveLength(0);
  });
});
