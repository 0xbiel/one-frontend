import * as THREE from "three";
import type { CameraRegistration, LastSeenObject } from "../models/domain";

const PERSON_VISIBLE_MS = 12_000;
const PERSON_RECENT_MS = 120_000;
const CAMERA_VIEW_DISTANCE_M = 0.62;
const MIN_FOV_DEGREES = 30;
const MAX_FOV_DEGREES = 120;

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

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calibratedHorizontalFov(registration: CameraRegistration): number | null {
  const explicit = finiteNumber(registration.intrinsics?.fov_degrees ?? registration.intrinsics?.fovDegrees);
  if (explicit !== null && explicit >= MIN_FOV_DEGREES && explicit <= MAX_FOV_DEGREES) return explicit;
  const diagnostics = registration.metrics?.diagnostics;
  if (diagnostics && typeof diagnostics === "object" && !Array.isArray(diagnostics)) {
    const selected = finiteNumber((diagnostics as Record<string, unknown>).selected_fov_degrees);
    if (selected !== null && selected >= MIN_FOV_DEGREES && selected <= MAX_FOV_DEGREES) return selected;
  }
  const matrix = registration.intrinsics?.matrix;
  if (!Array.isArray(matrix) || matrix.length !== 3 || matrix.some((row) => !Array.isArray(row) || row.length !== 3)) return null;
  const fx = finiteNumber(matrix[0][0]);
  const cx = finiteNumber(matrix[0][2]);
  if (fx === null || fx <= 0 || cx === null || cx <= 0) return null;
  const fov = 2 * Math.atan(cx / fx) * 180 / Math.PI;
  return fov >= MIN_FOV_DEGREES && fov <= MAX_FOV_DEGREES ? fov : null;
}

function calibratedFrustumHalfExtents(registration: CameraRegistration): { width: number; height: number | null; fovDegrees: number } | null {
  const fovDegrees = calibratedHorizontalFov(registration);
  if (fovDegrees === null) return null;
  const width = Math.tan((fovDegrees * Math.PI / 180) / 2) * CAMERA_VIEW_DISTANCE_M;
  const matrix = registration.intrinsics?.matrix;
  if (!Array.isArray(matrix) || matrix.length !== 3 || matrix.some((row) => !Array.isArray(row) || row.length !== 3)) {
    return { width, height: null, fovDegrees };
  }
  const fy = finiteNumber(matrix[1][1]);
  const cy = finiteNumber(matrix[1][2]);
  if (fy === null || fy <= 0 || cy === null || cy <= 0) return { width, height: null, fovDegrees };
  return { width, height: CAMERA_VIEW_DISTANCE_M * cy / fy, fovDegrees };
}

export function roomPlanCameraOverlayPoints(registration: CameraRegistration): { origin: THREE.Vector3; corners: THREE.Vector3[]; fovDegrees: number | null } | null {
  const matrix = registration.cameraToWorld;
  if (registration.status !== "positioned" || !matrix || matrix.length !== 4 || matrix.some((row) => row.length !== 4)) return null;

  const transform = cameraTransform(matrix);
  const halfExtents = calibratedFrustumHalfExtents(registration);
  const origin = new THREE.Vector3().applyMatrix4(transform);
  if (!halfExtents) return { origin, corners: [], fovDegrees: null };
  if (halfExtents.height === null) {
    return {
      origin,
      corners: [
        new THREE.Vector3(-halfExtents.width, 0, -CAMERA_VIEW_DISTANCE_M),
        new THREE.Vector3(halfExtents.width, 0, -CAMERA_VIEW_DISTANCE_M),
      ].map((point) => point.applyMatrix4(transform)),
      fovDegrees: halfExtents.fovDegrees,
    };
  }
  const corners = [
    new THREE.Vector3(-halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
    new THREE.Vector3(-halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
  ].map((point) => point.applyMatrix4(transform));
  return { origin, corners, fovDegrees: halfExtents.fovDegrees };
}

function addCamera(group: THREE.Group, registration: CameraRegistration, topDown: boolean): void {
  const matrix = registration.cameraToWorld;
  const overlay = roomPlanCameraOverlayPoints(registration);
  if (!overlay || !matrix) return;
  const color = registration.source === "placement-preview" ? 0xffb45f : 0x6fe0de;

  const cameraGroup = new THREE.Group();
  cameraGroup.name = `ONE camera ${registration.cameraId ?? "registered"}`;
  if (registration.cameraId) cameraGroup.userData.oneCameraId = registration.cameraId;
  cameraGroup.applyMatrix4(cameraTransform(matrix));

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.08, depthTest: !topDown }),
  );
  body.renderOrder = topDown ? 91 : 0;
  cameraGroup.add(body);

  // Keep the visible marker compact while giving mouse/touch selection a
  // forgiving target. The fully transparent mesh participates in raycasts
  // but does not alter the rendered RoomPlan scene.
  if (registration.cameraId) {
    const hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hitTarget.name = `ONE camera hit target ${registration.cameraId}`;
    cameraGroup.add(hitTarget);
  }

  const halfExtents = calibratedFrustumHalfExtents(registration);
  if (halfExtents) {
    const origin = new THREE.Vector3();
    const left = new THREE.Vector3(-halfExtents.width, 0, -CAMERA_VIEW_DISTANCE_M);
    const right = new THREE.Vector3(halfExtents.width, 0, -CAMERA_VIEW_DISTANCE_M);
    const frustumPoints = halfExtents.height === null
      ? [origin, left, origin, right, left, right]
      : (() => {
        const corners = [
          new THREE.Vector3(-halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
          new THREE.Vector3(halfExtents.width, halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
          new THREE.Vector3(halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
          new THREE.Vector3(-halfExtents.width, -halfExtents.height, -CAMERA_VIEW_DISTANCE_M),
        ];
        return [
          origin, corners[0], origin, corners[1], origin, corners[2], origin, corners[3],
          corners[0], corners[1], corners[1], corners[2], corners[2], corners[3], corners[3], corners[0],
        ];
      })();
    const frustum = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(frustumPoints),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: !topDown }),
    );
    frustum.renderOrder = topDown ? 90 : 0;
    cameraGroup.add(frustum);

    if (topDown) {
      const footprintGeometry = new THREE.BufferGeometry().setFromPoints([origin, left, right]);
      footprintGeometry.setIndex([0, 1, 2]);
      footprintGeometry.computeVertexNormals();
      const footprint = new THREE.Mesh(
        footprintGeometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthTest: false, side: THREE.DoubleSide }),
      );
      footprint.renderOrder = 89;
      cameraGroup.add(footprint);
    }
    cameraGroup.userData.oneFovDegrees = halfExtents.fovDegrees;
  }
  group.add(cameraGroup);
}

export function roomPlanCameraIdFromObject(object: THREE.Object3D | null): string | null {
  let current = object;
  while (current) {
    const cameraId = current.userData.oneCameraId;
    if (typeof cameraId === "string" && cameraId) return cameraId;
    current = current.parent;
  }
  return null;
}

export function roomPlanWorldPointFromObject(object: THREE.Object3D | null): THREE.Vector3 | null {
  let current = object;
  while (current) {
    const point = current.userData.oneWorldPoint;
    if (point && typeof point === "object") {
      const x = finiteNumber((point as Record<string, unknown>).x);
      const y = finiteNumber((point as Record<string, unknown>).y);
      const z = finiteNumber((point as Record<string, unknown>).z);
      if (x !== null && y !== null && z !== null) return new THREE.Vector3(x, y, z);
    }
    current = current.parent;
  }
  return null;
}

export function roomPlanSourceCameraIdFromObject(object: THREE.Object3D | null): string | null {
  let current = object;
  while (current) {
    const cameraId = current.userData.oneSourceCameraId;
    if (typeof cameraId === "string" && cameraId) return cameraId;
    current = current.parent;
  }
  return null;
}

export function roomPlanCameraIdsCoveringPoint(
  registrations: CameraRegistration[],
  mapId: string,
  point: { x: number; y: number; z: number },
): string[] {
  const worldPoint = new THREE.Vector3(point.x, point.y, point.z);
  const matches: Array<{ cameraId: string; distance: number }> = [];
  for (const registration of registrations) {
    const cameraId = registration.cameraId;
    const matrix = registration.cameraToWorld;
    const fovDegrees = calibratedHorizontalFov(registration);
    if (
      registration.status !== "positioned"
      || !cameraId
      || registration.mapId !== mapId
      || !matrix
      || matrix.length !== 4
      || matrix.some((row) => row.length !== 4)
      || fovDegrees === null
    ) continue;

    const transform = cameraTransform(matrix);
    const localPoint = worldPoint.clone().applyMatrix4(transform.clone().invert());
    const forwardDistance = -localPoint.z;
    if (forwardDistance <= 0.05) continue;
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(fovDegrees * 0.5)) * forwardDistance;
    if (Math.abs(localPoint.x) > halfWidth) continue;
    matches.push({ cameraId, distance: localPoint.length() });
  }
  matches.sort((left, right) => left.distance - right.distance);
  return matches.map((match) => match.cameraId);
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
  marker.userData.oneWorldPoint = { x: point.x, y: point.y, z: point.z };
  if (object.cameraId) marker.userData.oneSourceCameraId = object.cameraId;

  if (isPerson(object.label)) {
    const observedAt = Date.parse(object.lastSeenAt);
    const state = personPresenceState(object);
    if (state === 'stale') return;
    marker.userData.onePresenceState = state;
    marker.userData.oneExpiresAt = Number.isFinite(observedAt)
      ? observedAt + (state === 'current' ? PERSON_VISIBLE_MS : PERSON_RECENT_MS)
      : Date.now() + (state === 'current' ? PERSON_VISIBLE_MS : PERSON_RECENT_MS);
    if (topDown) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(state === 'current' ? 0.16 : 0.11, 28),
        new THREE.MeshBasicMaterial({ color: 0xffb45f, transparent: true, opacity: state === 'current' ? 0.95 : 0.35, depthTest: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.035;
      disc.renderOrder = 90;
      marker.add(disc);
    } else {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(state === 'current' ? 0.13 : 0.09, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xffb45f, transparent: true, opacity: state === 'current' ? 0.95 : 0.38, roughness: 0.6 }),
      );
      dot.position.y = state === 'current' ? 0.22 : 0.12;
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
    .forEach((registration) => addCamera(group, registration, topDown));
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
