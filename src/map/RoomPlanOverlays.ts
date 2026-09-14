import * as THREE from "three";
import type { CameraRegistration, LastSeenObject } from "../models/domain";

const PERSON_VISIBLE_MS = 12_000;
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
  if (registration.status !== "positioned" || !matrix || matrix.length !== 4 || matrix.some((row) => row.length !== 4)) return null;

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

function addCamera(group: THREE.Group, registration: CameraRegistration, topDown: boolean): void {
  const matrix = registration.cameraToWorld;
  if (!roomPlanCameraOverlayPoints(registration) || !matrix) return;

  const cameraGroup = new THREE.Group();
  cameraGroup.name = `ONE camera ${registration.cameraId ?? "registered"}`;
  cameraGroup.applyMatrix4(cameraTransform(matrix));

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.10),
    new THREE.MeshStandardMaterial({ color: 0x6fe0de, roughness: 0.4, metalness: 0.08, depthTest: !topDown }),
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
    new THREE.LineBasicMaterial({ color: 0x6fe0de, transparent: true, opacity: 0.9, depthTest: !topDown }),
  );
  frustum.renderOrder = topDown ? 90 : 0;
  cameraGroup.add(frustum);
  group.add(cameraGroup);
}

function isPerson(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized === "person" || normalized === "people" || normalized === "human";
}

function addObservedLocation(group: THREE.Group, object: LastSeenObject, mapId: string, topDown: boolean): void {
  if (!object.worldPoint || object.mapId !== mapId || !object.lastSeenAt) return;
  const point = object.worldPoint;
  const marker = new THREE.Group();
  marker.name = `ONE observed ${object.label}`;
  marker.position.set(point.x, point.y, point.z);

  if (isPerson(object.label)) {
    const observedAt = Date.parse(object.lastSeenAt);
    marker.userData.oneExpiresAt = Number.isFinite(observedAt) ? observedAt + PERSON_VISIBLE_MS : Date.now() + PERSON_VISIBLE_MS;
    if (topDown) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 28),
        new THREE.MeshBasicMaterial({ color: 0xffb45f, transparent: true, opacity: 0.95, depthTest: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.035;
      disc.renderOrder = 90;
      marker.add(disc);
    } else {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 0.46, 18),
        new THREE.MeshStandardMaterial({ color: 0xffb45f, roughness: 0.62 }),
      );
      body.position.y = 0.23;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xffc982, roughness: 0.6 }),
      );
      head.position.y = 0.58;
      marker.add(body, head);
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
  objects.forEach((object) => addObservedLocation(group, object, mapId, topDown));
}

export function refreshRoomPlanOverlayVisibility(group: THREE.Group, now = Date.now()): void {
  group.children.forEach((child) => {
    const expiresAt = child.userData.oneExpiresAt;
    if (typeof expiresAt === "number") child.visible = now <= expiresAt;
  });
}
