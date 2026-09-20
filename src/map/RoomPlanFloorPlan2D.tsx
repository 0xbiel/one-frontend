import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api } from "../api/client";
import type { CameraRegistration, LastSeenObject, Scene } from "../models/domain";
import { hasRenderableSpatial3D } from "./lidarGeometry";
import { parseRoomPlanUSDZ } from "./RoomPlanUSDZ";
import {
  clearRoomPlanOverlays,
  populateRoomPlanOverlays,
  refreshRoomPlanOverlayVisibility,
  roomPlanCameraIdFromObject,
  roomPlanCameraIdsCoveringPoint,
  roomPlanSourceCameraIdFromObject,
  roomPlanWorldPointFromObject,
} from "./RoomPlanOverlays";

function disposeTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineSegments)) return;
    node.geometry.dispose();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
    else node.material.dispose();
  });
}

function fitTopDownCamera(camera: THREE.OrthographicCamera, size: THREE.Vector3, aspect: number): void {
  const modelAspect = size.x / Math.max(size.z, 0.001);
  const padding = 1.16;
  let halfWidth: number;
  let halfHeight: number;
  if (aspect >= modelAspect) {
    halfHeight = Math.max(size.z * 0.5 * padding, 0.5);
    halfWidth = halfHeight * aspect;
  } else {
    halfWidth = Math.max(size.x * 0.5 * padding, 0.5);
    halfHeight = halfWidth / aspect;
  }
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

function floorPlanColor(path: string, darkMode: boolean): THREE.ColorRepresentation {
  if (darkMode) {
    if (path.includes("/Floors/")) return 0x273c49;
    if (path.includes("/Walls/")) return 0x5f7f91;
    if (path.includes("/Bed/") || path.includes("/Chair/") || path.includes("/Table/")) return 0x86adbd;
    return 0x739bac;
  }
  if (path.includes("/Floors/")) return 0xd5e1e7;
  if (path.includes("/Walls/")) return 0x9bb6c3;
  if (path.includes("/Bed/") || path.includes("/Chair/") || path.includes("/Table/")) return 0x6f9bad;
  return 0x83a9b8;
}

function appSurfaceIsDark(): boolean {
  const background = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!background || background.length !== 3) return false;
  const [red, green, blue] = background;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 128;
}

function styleAsFloorPlan(model: THREE.Group, darkMode: boolean): void {
  const meshes: THREE.Mesh[] = [];
  model.traverse((node) => {
    if (node instanceof THREE.Mesh) meshes.push(node);
  });

  for (const mesh of meshes) {
    const nativeMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const path = String(mesh.userData.roomPlanAssetPath ?? "");
    const opacity = nativeMaterial?.opacity ?? 1;
    const isOpening = /(?:^|\/)(?:Doors?|Windows?|Openings?)(?:\d+)?(?:\/|\.usd[ac]?$)/i.test(path);
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material.dispose();

    mesh.material = isOpening
      ? new THREE.MeshBasicMaterial({
          color: darkMode ? 0x5ad8dc : 0x087f88,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({
          color: floorPlanColor(path, darkMode),
          opacity,
          transparent: opacity < 1,
          depthWrite: opacity >= 1,
          side: THREE.DoubleSide,
          roughness: 1,
          metalness: 0,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });
    mesh.renderOrder = isOpening ? 50 : 0;

    if (opacity <= 0.01 && !isOpening) continue;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 24),
      new THREE.LineBasicMaterial({
        color: isOpening ? (darkMode ? 0x82f1f0 : 0x087f88) : darkMode ? 0xc2d7df : 0x385565,
        transparent: true,
        opacity: isOpening ? 0.92 : path.includes("/Floors/") ? 0.42 : 0.78,
        depthTest: !isOpening,
        depthWrite: false,
      }),
    );
    edges.name = `${mesh.name} plan outline`;
    edges.renderOrder = isOpening ? 51 : 1;
    mesh.add(edges);
  }
}

type FloorPlanPlacement = {
  enabled: boolean;
  onPoint: (point: { x: number; z: number }) => void;
  hint?: string;
};

export function RoomPlanFloorPlan2D({
  scene,
  objects,
  previewRegistration,
  placement,
  loadUSDZ,
  onCameraSelect,
}: {
  scene: Scene;
  objects: LastSeenObject[];
  previewRegistration?: CameraRegistration | null;
  placement?: FloorPlanPlacement;
  loadUSDZ?: (mapId: string) => Promise<ArrayBuffer>;
  onCameraSelect?: (cameraIds: string[]) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const overlayRootRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const placementRef = useRef<FloorPlanPlacement | undefined>(placement);
  const onCameraSelectRef = useRef<typeof onCameraSelect>(onCameraSelect);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const mapId = scene.mapId;
  const hasNativeGeometry = hasRenderableSpatial3D(scene);
  const registrations = useMemo(
    () => {
      const active = scene.cameraRegistrations?.length ? scene.cameraRegistrations : scene.cameraRegistration ? [scene.cameraRegistration] : [];
      if (!previewRegistration) return active;
      return [...active.filter((registration) => registration.cameraId !== previewRegistration.cameraId), previewRegistration];
    },
    [previewRegistration, scene.cameraRegistration, scene.cameraRegistrations],
  );

  useEffect(() => {
    placementRef.current = placement;
    if (controlsRef.current) controlsRef.current.enabled = !placement?.enabled;
  }, [placement]);

  useEffect(() => {
    onCameraSelectRef.current = onCameraSelect;
  }, [onCameraSelect]);

  useEffect(() => {
    if (!mount.current || !mapId || !hasNativeGeometry) {
      setLoadState("error");
      return;
    }

    const host = mount.current;
    let disposed = false;
    let frame = 0;
    let controls: OrbitControls | undefined;
    let renderer: THREE.WebGLRenderer | undefined;
    let roomRoot: THREE.Group | undefined;
    let resize: (() => void) | undefined;
    let placementCanvas: HTMLCanvasElement | undefined;
    let handlePlacementPointer: ((event: PointerEvent) => void) | undefined;
    let handleCameraPointerDown: ((event: PointerEvent) => void) | undefined;
    let handleCameraPointerUp: ((event: PointerEvent) => void) | undefined;
    setLoadState("loading");
    host.replaceChildren();

    const loadModel = loadUSDZ ?? api.getRoomPlanUSDZ;
    void loadModel(mapId).then((buffer) => {
      const model = parseRoomPlanUSDZ(buffer);
      // Follow ONE's rendered app surface rather than the OS preference. The
      // shell can be light while macOS is dark, which otherwise leaves a dark
      // RoomPlan canvas embedded in a light page.
      const darkMode = appSurfaceIsDark();
      styleAsFloorPlan(model, darkMode);
      if (disposed) {
        disposeTree(model);
        return;
      }

      const width = host.clientWidth || 640;
      const height = host.clientHeight || 440;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(darkMode ? 0x07090c : 0xffffff, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      host.replaceChildren(renderer.domElement);

      const world = new THREE.Scene();
      world.add(new THREE.HemisphereLight(0xffffff, 0x66798d, 2.7));
      const light = new THREE.DirectionalLight(0xffffff, 2.1);
      light.position.set(-3, 8, 4);
      world.add(light);

      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      roomRoot = new THREE.Group();
      // Keep the floor plan in the same handed top-down view used by the
      // Camera Positioning Lab: +X points right and +Z points up on screen.
      // The native top-down Three.js camera otherwise shows +Z downward,
      // which vertically mirrors the real room (door/table/bed ordering).
      roomRoot.position.set(-center.x, -center.y, center.z);
      roomRoot.scale.z = -1;
      roomRoot.add(model);
      const overlayRoot = new THREE.Group();
      overlayRoot.name = "ONE RoomPlan top-down overlays";
      roomRoot.add(overlayRoot);
      overlayRootRef.current = overlayRoot;
      world.add(roomRoot);

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      fitTopDownCamera(camera, size, width / height);
      camera.up.set(0, 0, -1);
      camera.position.set(0, Math.max(size.y * 2.5, 8), 0);
      camera.lookAt(0, 0, 0);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableRotate = false;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.screenSpacePanning = true;
      controls.minZoom = 0.75;
      controls.maxZoom = 5;
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.touches.ONE = THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      controls.enabled = !placementRef.current?.enabled;
      controlsRef.current = controls;
      controls.update();

      const raycaster = new THREE.Raycaster();
      const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const roomPlanPointFromDisplay = (point: THREE.Vector3) => new THREE.Vector3(
        point.x + center.x,
        point.y + center.y,
        center.z - point.z,
      );
      let cameraPointerStart: { x: number; y: number } | null = null;
      placementCanvas = renderer.domElement;
      handlePlacementPointer = (event: PointerEvent) => {
        const currentPlacement = placementRef.current;
        if (!currentPlacement?.enabled || !placementCanvas) return;
        const bounds = placementCanvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const pointer = new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -(((event.clientY - bounds.top) / bounds.height) * 2 - 1),
        );
        raycaster.setFromCamera(pointer, camera);
        const point = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(placementPlane, point)) return;
        const mapPoint = roomPlanPointFromDisplay(point);
        currentPlacement.onPoint({ x: mapPoint.x, z: mapPoint.z });
      };
      placementCanvas.addEventListener("pointerdown", handlePlacementPointer);
      handleCameraPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        cameraPointerStart = { x: event.clientX, y: event.clientY };
      };
      handleCameraPointerUp = (event: PointerEvent) => {
        const start = cameraPointerStart;
        cameraPointerStart = null;
        if (!start || event.button !== 0 || placementRef.current?.enabled || !onCameraSelectRef.current || !placementCanvas || !overlayRootRef.current) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
        const bounds = placementCanvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const pointer = new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -(((event.clientY - bounds.top) / bounds.height) * 2 - 1),
        );
        raycaster.setFromCamera(pointer, camera);
        for (const intersection of raycaster.intersectObjects(overlayRootRef.current.children, true)) {
          const cameraId = roomPlanCameraIdFromObject(intersection.object);
          if (cameraId) {
            onCameraSelectRef.current([cameraId]);
            return;
          }
          const observedPoint = roomPlanWorldPointFromObject(intersection.object);
          if (!observedPoint) continue;
          const sourceCameraId = roomPlanSourceCameraIdFromObject(intersection.object);
          const covering = roomPlanCameraIdsCoveringPoint(registrations, mapId, observedPoint);
          const cameraIds = [...new Set([...(sourceCameraId ? [sourceCameraId] : []), ...covering])];
          if (cameraIds.length) onCameraSelectRef.current(cameraIds);
          return;
        }

        const roomIntersection = raycaster.intersectObject(model, true)[0];
        if (!roomIntersection) return;
        const mapPoint = roomPlanPointFromDisplay(roomIntersection.point);
        const cameraIds = roomPlanCameraIdsCoveringPoint(registrations, mapId, mapPoint);
        if (cameraIds.length) onCameraSelectRef.current(cameraIds);
      };
      placementCanvas.addEventListener("pointerdown", handleCameraPointerDown);
      placementCanvas.addEventListener("pointerup", handleCameraPointerUp);

      const animate = () => {
        if (overlayRootRef.current) refreshRoomPlanOverlayVisibility(overlayRootRef.current);
        controls?.update();
        if (renderer) renderer.render(world, camera);
        frame = requestAnimationFrame(animate);
      };
      animate();

      resize = () => {
        if (!renderer) return;
        const nextWidth = host.clientWidth || width;
        const nextHeight = host.clientHeight || height;
        fitTopDownCamera(camera, size, nextWidth / nextHeight);
        renderer.setSize(nextWidth, nextHeight);
      };
      window.addEventListener("resize", resize);
      setLoadState("ready");
    }).catch(() => {
      if (!disposed) setLoadState("error");
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (resize) window.removeEventListener("resize", resize);
      controls?.dispose();
      controlsRef.current = null;
      if (placementCanvas && handlePlacementPointer) placementCanvas.removeEventListener("pointerdown", handlePlacementPointer);
      if (placementCanvas && handleCameraPointerDown) placementCanvas.removeEventListener("pointerdown", handleCameraPointerDown);
      if (placementCanvas && handleCameraPointerUp) placementCanvas.removeEventListener("pointerup", handleCameraPointerUp);
      overlayRootRef.current = null;
      if (roomRoot) disposeTree(roomRoot);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [hasNativeGeometry, loadUSDZ, mapId, scene.version]);

  useEffect(() => {
    const overlayRoot = overlayRootRef.current;
    if (!overlayRoot || !mapId || loadState !== "ready") return;
    populateRoomPlanOverlays(overlayRoot, registrations, objects, mapId, true);
    return () => clearRoomPlanOverlays(overlayRoot);
  }, [loadState, mapId, objects, registrations]);

  return (
    <div className={`three-scene lidar-scene roomplan-floor-plan ${placement?.enabled ? "is-placement-mode" : ""}`} aria-label="Top-down floor plan derived from the native LiDAR RoomPlan model" role="img">
      <div className="lidar-scene-canvas" ref={mount} />
      {loadState !== "ready" && (
        <div className="lidar-scene-status" role="status">
          {loadState === "loading" ? "Building floor plan from the native RoomPlan model…" : "Native RoomPlan floor plan unavailable."}
        </div>
      )}
      {loadState === "ready" && <div className="roomplan-floor-plan-badge">TOP-DOWN · NATIVE ROOMPLAN</div>}
      {loadState === "ready" && placement?.enabled && <div className="roomplan-placement-hint">{placement.hint ?? "Click the real camera position"}</div>}
    </div>
  );
}
