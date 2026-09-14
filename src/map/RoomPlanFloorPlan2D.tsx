import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api } from "../api/client";
import type { LastSeenObject, Scene } from "../models/domain";
import { hasRenderableSpatial3D } from "./lidarGeometry";
import { parseRoomPlanUSDZ } from "./RoomPlanUSDZ";
import { clearRoomPlanOverlays, populateRoomPlanOverlays, refreshRoomPlanOverlayVisibility } from "./RoomPlanOverlays";

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

function floorPlanColor(path: string): THREE.ColorRepresentation {
  if (path.includes("/Floors/")) return 0xdce6ed;
  if (path.includes("/Walls/")) return 0xf7f9fb;
  if (path.includes("/Bed/")) return 0xd0dbe4;
  if (path.includes("/Chair/")) return 0xc2d1dc;
  if (path.includes("/Table/")) return 0xb7c9d6;
  return 0xadbfcc;
}

function styleAsFloorPlan(model: THREE.Group): void {
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
          color: 0x142f49,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({
          color: floorPlanColor(path),
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
        color: isOpening ? 0x65cce0 : path.includes("/Walls/") ? 0x536d80 : 0x71899b,
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

export function RoomPlanFloorPlan2D({ scene, objects }: { scene: Scene; objects: LastSeenObject[] }) {
  const mount = useRef<HTMLDivElement>(null);
  const overlayRootRef = useRef<THREE.Group | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const mapId = scene.mapId;
  const hasNativeGeometry = hasRenderableSpatial3D(scene);
  const registrations = useMemo(
    () => scene.cameraRegistrations?.length ? scene.cameraRegistrations : scene.cameraRegistration ? [scene.cameraRegistration] : [],
    [scene.cameraRegistration, scene.cameraRegistrations],
  );

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
    setLoadState("loading");
    host.replaceChildren();

    void api.getRoomPlanUSDZ(mapId).then((buffer) => {
      const model = parseRoomPlanUSDZ(buffer);
      styleAsFloorPlan(model);
      if (disposed) {
        disposeTree(model);
        return;
      }

      const width = host.clientWidth || 640;
      const height = host.clientHeight || 440;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
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
      roomRoot.position.set(-center.x, -center.y, -center.z);
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
      controls.update();

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
      overlayRootRef.current = null;
      if (roomRoot) disposeTree(roomRoot);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [hasNativeGeometry, mapId, scene.version]);

  useEffect(() => {
    const overlayRoot = overlayRootRef.current;
    if (!overlayRoot || !mapId || loadState !== "ready") return;
    populateRoomPlanOverlays(overlayRoot, registrations, objects, mapId, true);
    return () => clearRoomPlanOverlays(overlayRoot);
  }, [loadState, mapId, objects, registrations]);

  return (
    <div className="three-scene lidar-scene roomplan-floor-plan" aria-label="Top-down floor plan derived from the native LiDAR RoomPlan model" role="img">
      <div className="lidar-scene-canvas" ref={mount} />
      {loadState !== "ready" && (
        <div className="lidar-scene-status" role="status">
          {loadState === "loading" ? "Building floor plan from the native RoomPlan model…" : "Native RoomPlan floor plan unavailable."}
        </div>
      )}
      {loadState === "ready" && <div className="roomplan-floor-plan-badge">TOP-DOWN · NATIVE ROOMPLAN</div>}
    </div>
  );
}
