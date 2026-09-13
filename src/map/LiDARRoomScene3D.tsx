import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RoomGeometry, Scene, SurfaceGeometry } from "../models/domain";
import { hasMeshData, hasRealLidarGeometry, hasSurfaceData } from "./lidarGeometry";
export { hasRealLidarGeometry } from "./lidarGeometry";

function faceIndices(faces: number[] | number[][]): number[] {
  if (!faces.length) return [];
  if (typeof faces[0] === "number") return faces as number[];
  return (faces as number[][]).flatMap((face) => {
    if (face.length < 3) return [];
    const triangles: number[] = [];
    for (let index = 1; index < face.length - 1; index += 1) triangles.push(face[0], face[index], face[index + 1]);
    return triangles;
  });
}

function createGeometry(vertices: Array<{ x: number; y: number; z: number }>, faces: number[] | number[][]): THREE.BufferGeometry | null {
  const indices = faceIndices(faces).filter((index) => index >= 0 && index < vertices.length);
  if (vertices.length < 3 || indices.length < 3) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((point) => [point.x, point.y, point.z]), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addSurface(group: THREE.Group, surface: SurfaceGeometry, index: number): void {
  if (!surface.faces || !hasSurfaceData(surface)) return;
  const geometry = createGeometry(surface.vertices, surface.faces);
  if (!geometry) return;
  const material = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x4d7888 : 0x47618a, transparent: true, opacity: 0.86, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.02 });
  group.add(new THREE.Mesh(geometry, material));
}

function addRoomPlanGeometry(group: THREE.Group, geometry: RoomGeometry): void {
  if (hasMeshData(geometry.mesh)) {
    const meshGeometry = createGeometry(geometry.mesh!.vertices, geometry.mesh!.faces);
    if (meshGeometry) group.add(new THREE.Mesh(meshGeometry, new THREE.MeshStandardMaterial({ color: 0x4a7194, transparent: true, opacity: 0.86, side: THREE.DoubleSide, roughness: 0.82 })));
  }
  geometry.surfaces?.forEach((surface, index) => addSurface(group, surface, index));
  geometry.objects?.forEach((object) => {
    const dimensions = object.dimensions;
    if (dimensions.x <= 0 || dimensions.y <= 0 || dimensions.z <= 0) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(dimensions.x, dimensions.y, dimensions.z), new THREE.MeshStandardMaterial({ color: 0x45d6e2, transparent: true, opacity: 0.72, roughness: 0.7 }));
    mesh.position.set(object.position.x, object.position.y, object.position.z);
    group.add(mesh);
  });
  geometry.walls.forEach((wall) => {
    if (!wall.start || !wall.end) return;
    const points = [new THREE.Vector3(wall.start.x, wall.start.y, wall.start.z), new THREE.Vector3(wall.end.x, wall.end.y, wall.end.z)];
    const wallGeometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(wallGeometry, new THREE.LineBasicMaterial({ color: 0xbed2e2 })));
  });

  geometry.roomZones?.forEach((zone, index) => {
    if (zone.polygon.length < 3) return;
    const vertices = zone.polygon.flatMap((point) => [point.x, zone.floorY + 0.012, point.z]);
    const indices: number[] = [];
    for (let vertex = 1; vertex < zone.polygon.length - 1; vertex += 1) indices.push(0, vertex, vertex + 1);
    const zoneGeometry = new THREE.BufferGeometry();
    zoneGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    zoneGeometry.setIndex(indices);
    zoneGeometry.computeVertexNormals();
    group.add(new THREE.Mesh(zoneGeometry, new THREE.MeshStandardMaterial({ color: index % 2 ? 0x285f78 : 0x254d72, transparent: true, opacity: 0.26, side: THREE.DoubleSide, roughness: 1 })));
    const boundary = [...zone.polygon, zone.polygon[0]].map((point) => new THREE.Vector3(point.x, zone.floorY + 0.025, point.z));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundary), new THREE.LineBasicMaterial({ color: 0x6fe0de, transparent: true, opacity: 0.75 })));
  });
}

function addRegisteredCameras(group: THREE.Group, scene: Scene): void {
  const registrations = scene.cameraRegistrations?.length
    ? scene.cameraRegistrations
    : scene.cameraRegistration ? [scene.cameraRegistration] : [];
  registrations.forEach((registration) => {
    const matrix = registration.cameraToWorld;
    if (registration.status !== "positioned" || !matrix || matrix.length !== 4 || matrix.some((row) => row.length !== 4)) return;
    const transform = new THREE.Matrix4().set(
      matrix[0][0], matrix[0][1], matrix[0][2], matrix[0][3],
      matrix[1][0], matrix[1][1], matrix[1][2], matrix[1][3],
      matrix[2][0], matrix[2][1], matrix[2][2], matrix[2][3],
      matrix[3][0], matrix[3][1], matrix[3][2], matrix[3][3],
    );
    const cameraGroup = new THREE.Group();
    cameraGroup.applyMatrix4(transform);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: 0x6fe0de, roughness: 0.4, metalness: 0.08 }));
    body.position.z = -0.02;
    cameraGroup.add(body);

    const distance = 1.35;
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(30)) * distance;
    const halfHeight = halfWidth * 0.65;
    const origin = new THREE.Vector3(0, 0, 0);
    const corners = [
      new THREE.Vector3(-halfWidth, halfHeight, -distance),
      new THREE.Vector3(halfWidth, halfHeight, -distance),
      new THREE.Vector3(halfWidth, -halfHeight, -distance),
      new THREE.Vector3(-halfWidth, -halfHeight, -distance),
    ];
    const frustumPoints = [
      origin, corners[0], origin, corners[1], origin, corners[2], origin, corners[3],
      corners[0], corners[1], corners[1], corners[2], corners[2], corners[3], corners[3], corners[0],
    ];
    cameraGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(frustumPoints), new THREE.LineBasicMaterial({ color: 0x6fe0de, transparent: true, opacity: 0.72 })));
    group.add(cameraGroup);
  });
}

export function LiDARRoomScene3D({ scene }: { scene: Scene }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mount.current || !hasRealLidarGeometry(scene)) return;
    const host = mount.current;
    const width = host.clientWidth || 640;
    const height = host.clientHeight || 440;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x17191f, 1);
    host.replaceChildren(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.01, 1000);
    const world = new THREE.Scene();
    world.add(new THREE.HemisphereLight(0xe2f1ff, 0x263044, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(4, 8, 5);
    world.add(keyLight);
    const model = new THREE.Group();
    addRoomPlanGeometry(model, scene.geometry!);
    addRegisteredCameras(model, scene);
    world.add(model);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const fitHeight = Math.max(size.z, 0.5) * 0.5 / Math.tan(verticalFov);
    const fitWidth = Math.max(size.x, 0.5) * 0.5 / Math.tan(verticalFov) / Math.max(camera.aspect, 0.2);
    const topDistance = Math.max(fitHeight, fitWidth, 0.8) * 1.18;
    camera.up.set(0, 0, -1);
    camera.position.set(center.x, bounds.max.y + topDistance, center.z);
    camera.lookAt(center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
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

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(world, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const resize = () => {
      const nextWidth = host.clientWidth || width;
      const nextHeight = host.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      controls.dispose();
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh || node instanceof THREE.Line)) return;
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material.dispose();
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, [scene]);

  return <div className="three-scene lidar-scene" ref={mount} aria-label="LiDAR RoomPlan three-dimensional room model" role="img" />;
}
