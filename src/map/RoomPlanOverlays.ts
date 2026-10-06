import * as THREE from "three";
import type { CameraRegistration, LastSeenObject } from "../models/domain";

const PERSON_VISIBLE_MS = 12_000;
const PERSON_RECENT_MS = 120_000;
const CAMERA_VIEW_DISTANCE_M = 0.62;

function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineSegments)) return;
    node.geometry.dispose();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
    else node.material.dispose();
  });
}

export function clearRoomPlanOverlays(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function cameraTransform(matrix: number[][]): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    matrix[0][0], matrix[0][1], matrix[0][2], matrix[0][3],
    matrix[1][0], matrix[1][1], matrix[1][2], matrix[1][3],
    matrix[2][0], matrix[2][1], matrix[2][2], matrix[2][3],
    matrix[3][0], matrix[3][1], matrix[3][2], matrix[3][3],
  );
}

function calibratedFrustumHalfExtents(registration: CameraRegistration): { width: number; height: number } {
  void registration;
  // Match the native iOS overlay exactly.
  return { width: 0.34, height: 0.22 };
}

export function roomPlanCameraOverlayPoints(registration: CameraRegistration): { origin: THREE.Vector3; corners: THREE.Vector3[] } | null {
  const matrix = registration.cameraToWorld;
  if (!matrix || matrix.length !== 4 || matrix.some((row) => row.length !== 4)) return null;

  const transform = cameraTransform(matrix);
  const halfExtents = calibratedFrustumHalfExtents(registration);
  const origin = new THREE.Vector3().applyMatrix4(transform);
  const corners = [
    new THREE.Vector3(-halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(-halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
  ].map((point) => point.applyMatrix4(transform));
  return { origin, corners };
}

type CameraOrbState = "identified" | "current" | "recent" | "unknown" | "offline";

function cameraOrbState(registration: CameraRegistration, objects: LastSeenObject[]): CameraOrbState {
  if (registration.status !== "positioned") return "unknown";
  const people = objects.filter((object) => isPerson(object.label) && object.cameraId === registration.cameraId && personPresenceState(object) !== "stale");
  if (people.some((object) => object.identity?.status === "matched")) return "identified";
  if (people.some((object) => personPresenceState(object) === "current")) return "current";
  if (people.some((object) => personPresenceState(object) === "recent")) return "recent";
  return "unknown";
}

function orbColor(state: CameraOrbState): number {
  switch (state) {
    case "identified": return 0x35c98a;
    case "current": return 0xff7a00;
    case "recent": return 0xffa14a;
    case "offline": return 0xef4d4d;
    default: return 0x8b95a5;
  }
}

function orbOpacity(state: CameraOrbState): number {
  return state === "recent" ? 0.38 : state === "offline" ? 0.92 : 0.96;
}

function addCamera(group: THREE.Group, registration: CameraRegistration, topDown: boolean, objects: LastSeenObject[]): void {
  const matrix = registration.cameraToWorld;
  const overlay = roomPlanCameraOverlayPoints(registration);
  if (!overlay || !matrix) return;
  const state = cameraOrbState(registration, objects);
  const color = orbColor(state);
  const opacity = orbOpacity(state);

  const cameraGroup = new THREE.Group();
  cameraGroup.name = `ONE camera ${registration.cameraId ?? "registered"}`;
  if (registration.cameraId) {
    cameraGroup.userData.oneCameraId = registration.cameraId;
    cameraGroup.userData.oneCameraState = state;
  }
  cameraGroup.applyMatrix4(cameraTransform(matrix));

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(topDown ? 0.14 : 0.12, 20, 14),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: !topDown }),
  );
  body.renderOrder = topDown ? 91 : 0;
  cameraGroup.add(body);

  const halfExtents = calibratedFrustumHalfExtents(registration);
  const origin = new THREE.Vector3();
  const corners = [
    new THREE.Vector3(-halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(-halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
  ];
  const frustumPoints = [
    origin, corners[0], origin, corners[1], origin, corners[2], origin, corners[3],
    corners[0], corners[1], corners[1], corners[2], corners[2], corners[3], corners[3], corners[0],
  ];
  const frustum = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(frustumPoints),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: !topDown }),
  );
  frustum.renderOrder = topDown ? 90 : 0;
  cameraGroup.add(frustum);
  group.add(cameraGroup);
}

function isPerson(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized === "person" || normalized === "people" || normalized === "human";
}

function personPresenceState(object: LastSeenObject, now = Date.now()): 'current' | 'recent' | 'stale' {
  if (object.presenceState === 'current' || object.presenceState === 'recent' || object.presenceState === 'stale') return object.presenceState;
  const observedAt = object.lastSeenAt ? Date.parse(object.lastSeenAt) : Number.NaN;
  if (!Number.isFinite(observedAt)) return 'stale';
  const age = Math.max(0, now - observedAt);
  if (age <= PERSON_VISIBLE_MS) return 'current';
  return age <= PERSON_RECENT_MS ? 'recent' : 'stale';
}

function addObservedLocation(group: THREE.Group, object: LastSeenObject, mapId: string, topDown: boolean): void {
  if (!object.worldPoint || object.mapId !== mapId || !object.lastSeenAt) return;
  const point = object.worldPoint;
  const marker = new THREE.Group();
  marker.name = `ONE observed ${object.label}`;
  marker.position.set(point.x, point.y, point.z);

  if (isPerson(object.label)) {
    const observedAt = Date.parse(object.lastSeenAt);
    const state = personPresenceState(object);
    if (state === 'stale') return;
    marker.userData.onePresenceState = state;
    marker.userData.oneExpiresAt = Number.isFinite(observedAt)
      ? observedAt + (state === 'current' ? PERSON_VISIBLE_MS : PERSON_RECENT_MS)
      : Date.now() + (state === 'current' ? PERSON_VISIBLE_MS : PERSON_RECENT_MS);
    const identified = object.identity?.status === "matched";
    const color = identified ? 0x35c98a : state === "current" ? 0xff7a00 : 0xffa14a;
    const opacity = identified ? (state === "recent" ? 0.46 : 0.96) : state === "current" ? 0.96 : 0.36;
    if (topDown) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(state === 'current' ? 0.22 : 0.16, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.035;
      disc.renderOrder = 90;
      marker.add(disc);
    } else {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(state === 'current' ? 0.17 : 0.12, 20, 16),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.6 }),
      );
      dot.position.y = state === 'current' ? 0.27 : 0.16;
      marker.add(dot);
    }
  } else {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(topDown ? 0.08 : 0.065, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x65cce0, emissive: 0x15384a, roughness: 0.5 }),
    );
    dot.position.y = topDown ? 0.05 : 0.08;
    marker.add(dot);
  }
  group.add(marker);
}

export function populateRoomPlanOverlays(
  group: THREE.Group,
  registrations: CameraRegistration[],
  objects: LastSeenObject[],
  mapId: string,
  topDown: boolean,
): void {
  clearRoomPlanOverlays(group);
  registrations
    .filter((registration) => registration.mapId === mapId)
    .forEach((registration) => addCamera(group, registration, topDown, objects));
  const newestByObject = new Map<string, LastSeenObject>();
  for (const object of objects) {
    const previous = newestByObject.get(object.id);
    const observedAt = object.lastSeenAt ? Date.parse(object.lastSeenAt) : Number.NEGATIVE_INFINITY;
    const previousAt = previous?.lastSeenAt ? Date.parse(previous.lastSeenAt) : Number.NEGATIVE_INFINITY;
    if (!previous || observedAt >= previousAt) newestByObject.set(object.id, object);
  }
  [...newestByObject.values()].forEach((object) => addObservedLocation(group, object, mapId, topDown));
}

export function refreshRoomPlanOverlayVisibility(group: THREE.Group, now = Date.now()): void {
  group.children.forEach((child) => {
    const expiresAt = child.userData.oneExpiresAt;
    if (typeof expiresAt === "number") child.visible = now <= expiresAt;
  });
}
