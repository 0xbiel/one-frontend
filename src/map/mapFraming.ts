/** Vertical eye-to-model distance that fits both screen axes in top-down view. */
export function topDownFitDistance(width: number, depth: number, viewportAspect: number, verticalFovDegrees: number, padding = 1.16): number {
  const tangent = Math.tan(verticalFovDegrees * Math.PI / 360);
  const aspect = Math.max(viewportAspect, 0.1);
  return Math.max(Math.max(depth / 2, width / (2 * aspect)) / Math.max(tangent, 0.01) * padding, 0.8);
}
