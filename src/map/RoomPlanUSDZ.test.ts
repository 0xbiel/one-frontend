import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { strToU8, zipSync } from "fflate";
import { parseRoomPlanUSDZ } from "./RoomPlanUSDZ";

describe("parseRoomPlanUSDZ", () => {
  it("preserves native mesh transforms and triangulates RoomPlan faces", () => {
    const root = `#usda 1.0
def Xform "Room" {
  def Xform "Table_grp" (
    prepend references = @./assets/Model/Table/Table0.usda@
  ) {}
}`;
    const asset = `#usda 1.0
def Xform "Table0" {
  def Mesh "Table0" {
    int[] faceVertexCounts = [4]
    int[] faceVertexIndices = [0, 1, 2, 3]
    point3f[] points = [(0, 0, 0), (2, 0, 0), (2, 0, 1), (0, 0, 1)]
    matrix4d xformOp:transform = ( (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (3, 0, -2, 1) )
  }
}`;
    const zipped = zipSync({
      "room.usda": strToU8(root),
      "assets/Model/Table/Table0.usda": strToU8(asset),
    });
    const buffer = new Uint8Array(zipped).buffer;
    const group = parseRoomPlanUSDZ(buffer);
    const mesh = group.children[0] as THREE.Mesh;

    expect(group.children).toHaveLength(1);
    expect(mesh.position.toArray()).toEqual([3, 0, -2]);
    expect(mesh.userData.roomPlanAssetPath).toBe("assets/Model/Table/Table0.usda");
    expect(Array.from(mesh.geometry.index?.array ?? [])).toEqual([0, 1, 2, 0, 2, 3]);
    expect(new THREE.Box3().setFromObject(group).min.toArray()).toEqual([3, 0, -2]);
    expect(new THREE.Box3().setFromObject(group).max.toArray()).toEqual([5, 0, -1]);
  });

  it("preserves transparent RoomPlan door and window materials so wall cut-outs stay visible", () => {
    const root = `#usda 1.0
def Xform "Room" {
  def Xform "Door_grp" (
    prepend references = @./assets/Model/Walls/Wall0/Door0.usda@
  ) {}
}`;
    const door = `#usda 1.0
def Xform "Door0" {
  def Mesh "Door0" {
    int[] faceVertexCounts = [3]
    int[] faceVertexIndices = [0, 1, 2]
    point3f[] points = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
  }
  def Material "Door0_color" {
    color3f inputs:diffuseColor = (0, 0, 0)
    float inputs:opacity = 0
  }
}`;
    const zipped = zipSync({
      "room.usda": strToU8(root),
      "assets/Model/Walls/Wall0/Door0.usda": strToU8(door),
    });
    const mesh = parseRoomPlanUSDZ(new Uint8Array(zipped).buffer).children[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;

    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0);
    expect(material.depthWrite).toBe(false);
  });
});
