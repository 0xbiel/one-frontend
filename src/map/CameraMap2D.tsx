import { useId } from "react";
import { Camera } from "lucide-react";
import type { LastSeenObject, Point2D, Scene } from "../models/domain";

type CameraMap2DProps = {
  scene: Scene;
  objects: LastSeenObject[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

const polygonColors = ["#2e638a", "#356f70", "#65578e", "#627746", "#7b5f48"];

function pointString(points: Point2D[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
function bounded(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function hasCameraGeometry(scene: Scene): boolean {
  return Boolean(scene.geometry?.polygons.length || scene.geometry?.walls.length);
}

export function CameraMap2D({ scene, objects, selectedId, onSelect }: CameraMap2DProps) {
  const patternId = `${useId().replace(/:/g, "")}-map-grid`;
  const polygons = scene.geometry?.polygons ?? [];
  const walls = scene.geometry?.walls ?? scene.walls ?? [];
  const camera = scene.camera?.position;
  const hasGeometry = polygons.length > 0 || walls.some((wall) => wall.points.length > 1);

  return (
    <div className="camera-map-2d" aria-label="Camera-derived two-dimensional room map">
      <svg className="camera-map-svg" viewBox="0 0 100 100" role="img" aria-labelledby={`${patternId}-title ${patternId}-description`}>
        <title id={`${patternId}-title`}>Camera-derived 2D room map</title>
        <desc id={`${patternId}-description`}>
          {hasGeometry
            ? "Approximate room geometry generated from the approved camera sweep. The map has no measured scale."
            : "No camera-derived room geometry is available yet."}
        </desc>
        <defs>
          <pattern id={patternId} width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#dce8f3" strokeWidth="0.18" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#${patternId})`} />
        {polygons.map((polygon, index) => (
          <polygon
            key={polygon.id}
            className="camera-map-polygon"
            points={pointString(polygon.points)}
            fill={polygonColors[index % polygonColors.length]}
            fillOpacity={Math.min(0.82, Math.max(0.32, polygon.confidence ?? 0.58))}
            stroke="#ffffff"
            strokeOpacity="0.74"
            strokeWidth="0.55"
          >
            <title>{`${polygon.label ?? "Room area"}${polygon.confidence === undefined ? "" : ` · ${Math.round(polygon.confidence * 100)}% confidence`}`}</title>
          </polygon>
        ))}
        {walls.map((wall) => (
          wall.points.length > 1 ? (
            <polyline key={wall.id} className="camera-map-wall" points={pointString(wall.points)} fill="none" stroke="#193a62" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
          ) : null
        ))}
        {polygons.map((polygon) => {
          const center = polygon.points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
          center.x /= polygon.points.length;
          center.y /= polygon.points.length;
          return <text key={`${polygon.id}-label`} className="camera-map-label" x={center.x} y={center.y}>{(polygon.label ?? polygon.id).toUpperCase()}</text>;
        })}
        {camera && (
          <g className="camera-map-camera" transform={`translate(${bounded(camera.x)} ${bounded(camera.y)}) rotate(${scene.camera?.headingDegrees ?? 0})`} aria-label="Camera position">
            <path d="M 0 0 L -9 14 L 9 14 Z" fill="#45d6e2" fillOpacity="0.2" stroke="#1679a4" strokeWidth="0.45" />
            <circle r="2.4" fill="#1769e8" stroke="#ffffff" strokeWidth="0.7" />
            <Camera size={4} x={-2} y={-2} color="#ffffff" aria-hidden="true" />
          </g>
        )}
        {objects.filter((object) => object.point).map((object) => {
          const point = object.point!;
          const selected = selectedId === object.id;
          return (
            <g
              key={object.id}
              className={`camera-map-marker ${selected ? "selected" : ""}`}
              transform={`translate(${bounded(point.x)} ${bounded(point.y)})`}
              role="button"
              tabIndex={0}
              aria-label={`${object.label}, ${object.zone?.name ?? "location unknown"}`}
              onClick={() => onSelect(object.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(object.id);
                }
              }}
            >
              <circle className="camera-map-marker-ring" r={selected ? 5.8 : 5.1} />
              <circle className="camera-map-marker-dot" r={selected ? 3.5 : 3.1} />
              <text className="camera-map-marker-icon" x="0" y="1.2" textAnchor="middle">{object.icon}</text>
              <title>{`${object.label} · ${object.zone?.name ?? "location unknown"}`}</title>
            </g>
          );
        })}
      </svg>
      {!hasGeometry && (
        <div className="scene-empty-state">
          <strong>{scene.geometryStatus === "needs_rescan" ? "A fresh room sweep is needed" : "No camera geometry yet"}</strong>
          <span>{scene.geometryStatus === "needs_rescan" ? "Reconnect the camera and take the guided sweep again." : "Connect a camera and complete its guided room sweep to build this view."}</span>
        </div>
      )}
    </div>
  );
}
