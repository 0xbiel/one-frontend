import { useEffect, useRef } from "react";
import * as THREE from "three";
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
    world.add(model);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    camera.position.set(center.x + radius * 1.45, center.y + radius * 1.2, center.z + radius * 1.55);
    camera.lookAt(center);
    renderer.render(world, camera);

    const resize = () => {
      const nextWidth = host.clientWidth || width;
      const nextHeight = host.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      renderer.render(world, camera);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
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
