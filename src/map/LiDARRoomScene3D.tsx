import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api } from "../api/client";
import type { LastSeenObject, Scene } from "../models/domain";
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
export { hasRealLidarGeometry, hasRenderableSpatial3D } from "./lidarGeometry";

function disposeTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.LineSegments)) return;
    node.geometry.dispose();
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
    else node.material.dispose();
  });
}

function appSurfaceIsDark(): boolean {
  const background = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!background || background.length !== 3) return false;
  const [red, green, blue] = background;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 128;
}

function styleRoomModel(model: THREE.Group, darkMode: boolean): void {
  const palette = darkMode
    ? { floor: 0x35586d, wall: 0x6b8ca0, object: 0x8fb7c7, opening: 0x5ad8dc, edge: 0xd3e8ef }
    : { floor: 0xaec5d1, wall: 0x607b8c, object: 0x385a70, opening: 0x0b9ca5, edge: 0x162c3b };
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const path = String(node.userData.roomPlanAssetPath ?? node.name).toLowerCase();
    const color = path.includes("floor")
      ? palette.floor
      : path.includes("wall")
        ? palette.wall
        : path.includes("door") || path.includes("window") || path.includes("opening")
          ? palette.opening
          : palette.object;
    if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
    else node.material.dispose();
    node.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(node.geometry, 24),
      new THREE.LineBasicMaterial({ color: palette.edge, transparent: true, opacity: darkMode ? 0.52 : 0.38 }),
    );
    edges.name = `${node.name} spatial edges`;
    node.add(edges);
  });
}

export function LiDARRoomScene3D({ scene, objects, onCameraSelect }: { scene: Scene; objects: LastSeenObject[]; onCameraSelect?: (cameraIds: string[]) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const overlayRootRef = useRef<THREE.Group | null>(null);
  const onCameraSelectRef = useRef<typeof onCameraSelect>(onCameraSelect);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const hasNativeGeometry = hasRenderableSpatial3D(scene);
  const mapId = scene.mapId;
  const registrations = useMemo(
    () => scene.cameraRegistrations?.length ? scene.cameraRegistrations : scene.cameraRegistration ? [scene.cameraRegistration] : [],
    [scene.cameraRegistration, scene.cameraRegistrations],
  );

  useEffect(() => {
    onCameraSelectRef.current = onCameraSelect;
  }, [onCameraSelect]);

  useEffect(() => {
    if (!mount.current || !hasNativeGeometry || !mapId) {
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
    let interactionCanvas: HTMLCanvasElement | undefined;
    let handleCameraPointerDown: ((event: PointerEvent) => void) | undefined;
    let handleCameraPointerUp: ((event: PointerEvent) => void) | undefined;
    setLoadState("loading");
    host.replaceChildren();

    void api.getRoomPlanUSDZ(mapId).then((buffer) => {
      const nativeModel = parseRoomPlanUSDZ(buffer);
      nativeModel.traverse((node) => {
        const path = String(node.userData.roomPlanAssetPath ?? node.name).toLowerCase();
        if (path.includes("door") || path.includes("window") || path.includes("opening")) {
          node.userData.roomPlanOpening = true;
        }
      });
      const darkMode = appSurfaceIsDark();
      styleRoomModel(nativeModel, darkMode);
      if (disposed) {
        disposeTree(nativeModel);
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
      renderer.toneMappingExposure = 1.12;
      host.replaceChildren(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(46, width / height, 0.01, 1000);
      const world = new THREE.Scene();
      world.add(new THREE.HemisphereLight(darkMode ? 0xdceaf2 : 0xffffff, darkMode ? 0x17232c : 0x718096, darkMode ? 2.85 : 2.45));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(4, 8, 5);
      world.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xd9e4ef, 0.9);
      fillLight.position.set(-4, 5, -3);
      world.add(fillLight);

      const bounds = new THREE.Box3().setFromObject(nativeModel);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      roomRoot = new THREE.Group();
      roomRoot.add(nativeModel);
      roomRoot.position.set(-center.x, -center.y, -center.z);
      const overlayRoot = new THREE.Group();
      overlayRoot.name = "ONE RoomPlan overlays";
      roomRoot.add(overlayRoot);
      overlayRootRef.current = overlayRoot;
      world.add(roomRoot);

      const radius = Math.max(size.x, size.y, size.z, 1);
      const halfSpan = Math.max(size.x, size.z) * 0.5;
      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const fitDistance = Math.max(halfSpan / Math.max(Math.tan(halfFov), 0.1) * 1.2, 0.8);
      camera.up.set(0, 0, -1);
      camera.position.set(0, Math.max(size.y * 0.5 + fitDistance, 1.2), 0);
      camera.lookAt(0, 0, 0);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.screenSpacePanning = true;
      controls.minDistance = Math.max(radius * 0.08, 0.15);
      controls.maxDistance = radius * 18;
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
      controls.touches.ONE = THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      controls.update();

      const raycaster = new THREE.Raycaster();
      let cameraPointerStart: { x: number; y: number } | null = null;
      interactionCanvas = renderer.domElement;
      handleCameraPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        cameraPointerStart = { x: event.clientX, y: event.clientY };
      };
      handleCameraPointerUp = (event: PointerEvent) => {
        const start = cameraPointerStart;
        cameraPointerStart = null;
        if (!start || event.button !== 0 || !onCameraSelectRef.current || !interactionCanvas || !overlayRootRef.current) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
        const bounds = interactionCanvas.getBoundingClientRect();
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

        const roomIntersection = raycaster.intersectObject(nativeModel, true)[0];
        if (!roomIntersection) return;
        const mapPoint = roomIntersection.point.clone().add(center);
        const cameraIds = roomPlanCameraIdsCoveringPoint(registrations, mapId, mapPoint);
        if (cameraIds.length) onCameraSelectRef.current(cameraIds);
      };
      interactionCanvas.addEventListener("pointerdown", handleCameraPointerDown);
      interactionCanvas.addEventListener("pointerup", handleCameraPointerUp);

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
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
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
      if (interactionCanvas && handleCameraPointerDown) interactionCanvas.removeEventListener("pointerdown", handleCameraPointerDown);
      if (interactionCanvas && handleCameraPointerUp) interactionCanvas.removeEventListener("pointerup", handleCameraPointerUp);
      overlayRootRef.current = null;
      if (roomRoot) disposeTree(roomRoot);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [hasNativeGeometry, mapId, scene.dimension, scene.source, scene.version]);

  useEffect(() => {
    const overlayRoot = overlayRootRef.current;
    if (!overlayRoot || !mapId || loadState !== "ready") return;
    populateRoomPlanOverlays(overlayRoot, registrations, objects, mapId, false);
    return () => clearRoomPlanOverlays(overlayRoot);
  }, [loadState, mapId, objects, registrations]);

  return (
    <div className="three-scene lidar-scene" aria-label={scene.source === "roomplan-lidar-3d" ? "Native LiDAR RoomPlan three-dimensional room model" : "ARKit video three-dimensional room model"} role="img">
      <div className="lidar-scene-canvas" ref={mount} />
      {loadState !== "ready" && (
        <div className="lidar-scene-status" role="status">
          {loadState === "loading" ? "Loading 3D room model…" : "3D room model unavailable."}
        </div>
      )}
    </div>
  );
}
