import { describe, expect, it } from "vitest";
import { topDownFitDistance } from "./mapFraming";
describe("Top-down map framing", () => {
 it("fits the horizontal axis in a narrow viewport", () => {
  const portrait = topDownFitDistance(12, 3, 0.5, 46);
  const landscape = topDownFitDistance(12, 3, 2, 46);
  const halfVerticalSpan = portrait * Math.tan(46 * Math.PI / 360);
  expect(halfVerticalSpan * 0.5).toBeGreaterThan(6);
  expect(portrait).toBeGreaterThan(landscape);
 });
 it("fits the depth axis in a wide viewport", () => {
  const distance = topDownFitDistance(3, 12, 2, 46);
  expect(distance * Math.tan(46 * Math.PI / 360)).toBeGreaterThan(6);
 });
});
