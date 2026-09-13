import type { MeshGeometry, Scene, SurfaceGeometry } from "../models/domain";

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

export function hasMeshData(mesh: MeshGeometry | undefined): boolean {
  return Boolean(mesh && mesh.vertices.length >= 3 && faceIndices(mesh.faces).length >= 3);
}

export function hasSurfaceData(surface: SurfaceGeometry): boolean {
  return surface.vertices.length >= 3 && Boolean(surface.faces && faceIndices(surface.faces).length >= 3);
}

function hasLidarWall(scene: Scene): boolean {
  return Boolean(scene.geometry?.walls.some((wall) =>
    wall.start && wall.end && Number.isFinite(wall.start.z) && Number.isFinite(wall.end.z),
  ));
}

/** True only for a validated RoomPlan/LiDAR scene containing real 3D geometry. */
export function hasRealLidarGeometry(scene: Scene): boolean {
  if (scene.source !== "roomplan-lidar-3d" || scene.dimension !== "3d" || !scene.geometry) return false;
  return hasMeshData(scene.geometry.mesh)
    || Boolean(scene.geometry.surfaces?.some(hasSurfaceData))
    || hasLidarWall(scene)
    || Boolean(scene.geometry.objects?.length);
}
