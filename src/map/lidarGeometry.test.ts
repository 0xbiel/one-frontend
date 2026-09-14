import { describe, expect, it } from "vitest";
import type { Scene } from "../models/domain";
import { hasRealLidarGeometry, hasRenderableSpatial3D } from "./lidarGeometry";

function scene(source: Scene["source"], dimension: Scene["dimension"] = "3d"): Scene {
  return {
    sceneId: "scene-1",
    version: 1,
    zones: [],
    dimension,
    source,
    metricScaleKnown: dimension === "3d",
    geometryStatus: "ready",
    geometry: {
      polygons: [],
      walls: [],
      surfaces: [{
        id: "floor",
        kind: "floor",
        vertices: [
          { x: -1, y: 0, z: -1 },
          { x: 1, y: 0, z: -1 },
          { x: 1, y: 0, z: 1 },
        ],
        faces: [[0, 1, 2]],
      }],
    },
  };
}

describe("native spatial 3D gating", () => {
  it("renders validated ARKit video geometry without treating it as LiDAR", () => {
    const arkit = scene("arkit-video-3d");
    expect(hasRenderableSpatial3D(arkit)).toBe(true);
    expect(hasRealLidarGeometry(arkit)).toBe(false);
  });

  it("keeps RoomPlan LiDAR valid and rejects 2D sources", () => {
    expect(hasRenderableSpatial3D(scene("roomplan-lidar-3d"))).toBe(true);
    expect(hasRealLidarGeometry(scene("roomplan-lidar-3d"))).toBe(true);
    expect(hasRenderableSpatial3D(scene("camera-cv-2d", "2d"))).toBe(false);
  });
});
