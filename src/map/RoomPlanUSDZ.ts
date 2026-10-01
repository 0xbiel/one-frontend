import * as THREE from "three";
import { strFromU8, unzipSync } from "fflate";

const NUMBER_PATTERN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

function numberList(value: string | undefined): number[] {
  if (!value) return [];
  return (value.match(NUMBER_PATTERN) ?? []).map(Number).filter(Number.isFinite);
}

function arrayBody(source: string, declaration: RegExp): string | undefined {
  return declaration.exec(source)?.[1];
}

function triangulate(faceCounts: number[], faceIndices: number[]): number[] {
  if (!faceCounts.length) return faceIndices;
  const triangles: number[] = [];
  let offset = 0;
  for (const count of faceCounts) {
    if (count >= 3 && offset + count <= faceIndices.length) {
      for (let index = 1; index < count - 1; index += 1) {
        triangles.push(faceIndices[offset], faceIndices[offset + index], faceIndices[offset + index + 1]);
      }
    }
    offset += count;
  }
  return triangles;
}

function meshTransform(source: string): number[] | undefined {
  const line = source.split("\n").find((candidate) => candidate.includes("matrix4d xformOp:transform"));
  const values = numberList(line?.split("=").slice(1).join("="));
  return values.length === 16 ? values : undefined;
}

function materialFor(path: string, source: string): THREE.MeshStandardMaterial {
  const isFloor = path.includes("/Floors/");
  const isWall = path.includes("/Walls/");
  const nativeColor = numberList(/color3f\s+inputs:diffuseColor\s*=\s*\(([^)]*)\)/.exec(source)?.[1]);
  const nativeOpacity = numberList(/float\s+inputs:opacity\s*=\s*([^\n]+)/.exec(source)?.[1])[0];
  const opacity = nativeOpacity === undefined ? 1 : THREE.MathUtils.clamp(nativeOpacity, 0, 1);
  const color = nativeColor.length >= 3
    ? new THREE.Color(nativeColor[0], nativeColor[1], nativeColor[2])
    : new THREE.Color(isFloor ? 0xdadada : isWall ? 0xe7e7e7 : 0xf1f1f1);
  return new THREE.MeshStandardMaterial({
    color,
    opacity,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  });
}

function meshFromUSDA(path: string, source: string): THREE.Mesh | null {
  const pointValues = numberList(arrayBody(source, /point3f\[\]\s+points\s*=\s*\[([\s\S]*?)\]/));
  const faceIndices = numberList(arrayBody(source, /int\[\]\s+faceVertexIndices\s*=\s*\[([\s\S]*?)\]/)).map(Math.trunc);
  const faceCounts = numberList(arrayBody(source, /int\[\]\s+faceVertexCounts\s*=\s*\[([\s\S]*?)\]/)).map(Math.trunc);
  if (pointValues.length < 9 || pointValues.length % 3 !== 0 || faceIndices.length < 3) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pointValues, 3));
  geometry.setIndex(triangulate(faceCounts, faceIndices));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materialFor(path, source));
  mesh.name = path.split("/").at(-1)?.replace(/\.usda$/i, "") ?? "RoomPlan mesh";
  mesh.userData.roomPlanAssetPath = path;
  const transform = meshTransform(source);
  if (transform) {
    // USD serializes matrices as row vectors with translation in the last row.
    // Three stores Matrix4 elements column-major, so copying the flattened USD
    // values directly performs the same transpose used by Three's USDZ loader.
    mesh.matrix.fromArray(transform);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  }
  return mesh;
}

function referencedAssets(zip: Record<string, Uint8Array>): string[] {
  const rootName = Object.keys(zip).find((name) => !name.startsWith("assets/") && /\.usd[ac]?$/i.test(name));
  if (!rootName) return [];
  const root = strFromU8(zip[rootName]);
  const paths = Array.from(root.matchAll(/@\.\/([^@]+\.usd[ac]?)@/gi), (match) => match[1]);
  return Array.from(new Set(paths));
}

/** Parse the native ASCII RoomPlan USDZ package into Three meshes without rebuilding geometry. */
export function parseRoomPlanUSDZ(buffer: ArrayBuffer): THREE.Group {
  const zip = unzipSync(new Uint8Array(buffer));
  const assetPaths = referencedAssets(zip);
  const candidates = assetPaths.length
    ? assetPaths
    : Object.keys(zip).filter((name) => name.startsWith("assets/Model/") && /\.usd[ac]?$/i.test(name));
  const group = new THREE.Group();
  group.name = "Native RoomPlan USDZ";

  for (const path of candidates) {
    const bytes = zip[path];
    if (!bytes) continue;
    const mesh = meshFromUSDA(path, strFromU8(bytes));
    if (mesh) group.add(mesh);
  }

  if (!group.children.length) throw new Error("ROOMPLAN_USDZ_GEOMETRY_UNAVAILABLE");
  return group;
}
