import { useId, type MouseEvent } from "react";
import { Camera } from "lucide-react";
import type { LastSeenObject, Point2D, Scene } from "../models/domain";

type CameraMap2DProps = {
  scene: Scene;
  objects: LastSeenObject[];
  selectedId?: string;
  onSelect: (id: string) => void;
  measurement?: { points: Point2D[]; onPoint: (point: Point2D) => void };
};

const polygonColors = ["#2e638a", "#356f70", "#65578e", "#627746", "#7b5f48"];

function pointString(points: Point2D[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
function bounded(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function measuredDimension(item: { size: Point2D }, scene: Scene): string | null {
  const metersPerNormalizedUnit = scene.scale?.metersPerNormalizedUnit;
  if (!metersPerNormalizedUnit) return null;
  const width = (item.size.x / 100) * metersPerNormalizedUnit;
  const height = (item.size.y / 100) * metersPerNormalizedUnit;
  return `${width.toFixed(2)} × ${height.toFixed(2)} m`;
}

function scaleBar(scene: Scene): { width: number; meters: number } | null {
  const metersPerNormalizedUnit = scene.scale?.metersPerNormalizedUnit;
  if (!metersPerNormalizedUnit || !Number.isFinite(metersPerNormalizedUnit)) return null;
  const mapUnitsPerMeter = 100 / metersPerNormalizedUnit;
  const choices = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
  const selected = choices.find((meters) => mapUnitsPerMeter * meters >= 10 && mapUnitsPerMeter * meters <= 30) ?? choices[0];
  const width = mapUnitsPerMeter * selected;
  return width > 0 && width <= 100 ? { width, meters: selected } : null;
}

export function hasCameraGeometry(scene: Scene): boolean {
  return Boolean(scene.geometry?.polygons.length || scene.geometry?.walls.length || scene.geometry?.furniture?.length || scene.geometry?.openings?.length);
}

export function CameraMap2D({ scene, objects, selectedId, onSelect, measurement }: CameraMap2DProps) {
  const patternId = `${useId().replace(/:/g, "")}-map-grid`;
  const polygons = scene.geometry?.polygons ?? [];
  const walls = scene.geometry?.walls ?? scene.walls ?? [];
  const furniture = scene.geometry?.furniture ?? [];
  const openings = scene.geometry?.openings ?? [];
  const camera = scene.camera?.position;
  const hasGeometry = polygons.length > 0 || walls.some((wall) => wall.points.length > 1) || furniture.length > 0 || openings.length > 0;

  return (
    <div className="camera-map-2d" aria-label="Camera-derived two-dimensional room map">
      <svg
        className={`camera-map-svg${measurement ? " is-measuring" : ""}`}
        viewBox="0 0 100 100"
        role="img"
        aria-label={measurement ? "Map scale measurement: click two points" : undefined}
        aria-labelledby={`${patternId}-title ${patternId}-description`}
        onClick={(event: MouseEvent<SVGSVGElement>) => {
          if (!measurement) return;
          const svg = event.currentTarget;
          const transform = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
          if (transform && typeof svg.createSVGPoint === "function") {
            const point = svg.createSVGPoint();
            point.x = event.clientX;
            point.y = event.clientY;
            const mapped = point.matrixTransform(transform.inverse());
            measurement.onPoint({ x: bounded(mapped.x), y: bounded(mapped.y) });
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          measurement.onPoint({
            x: bounded(((event.clientX - bounds.left) / bounds.width) * 100),
            y: bounded(((event.clientY - bounds.top) / bounds.height) * 100),
          });
        }}
      >
        <title id={`${patternId}-title`}>Camera-derived 2D room map</title>
        <desc id={`${patternId}-description`}>
          {hasGeometry
            ? scene.scale
              ? "Approximate room geometry, furniture, doors, and windows generated from the approved camera sweep. A caregiver-measured reference provides the displayed scale."
              : "Approximate room geometry, furniture, doors, and windows generated from the approved camera sweep. The map has no measured scale."
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
        {openings.map((opening) => (
          <g key={opening.id} className={`camera-map-opening ${opening.kind}`} aria-label={`${opening.kind} opening`}>
            <line
              x1={bounded(opening.start.x)}
              y1={bounded(opening.start.y)}
              x2={bounded(opening.end.x)}
              y2={bounded(opening.end.y)}
              stroke={opening.kind === "door" ? "#f59e0b" : "#45d6e2"}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <line
              x1={bounded(opening.start.x)}
              y1={bounded(opening.start.y)}
              x2={bounded(opening.end.x)}
              y2={bounded(opening.end.y)}
              stroke="#ffffff"
              strokeWidth="0.55"
              strokeDasharray={opening.kind === "door" ? "1.8 1.2" : undefined}
              strokeLinecap="round"
            />
            <title>{`${opening.kind === "door" ? "Door" : "Window"}${opening.confidence === undefined ? "" : ` · ${Math.round(opening.confidence * 100)}% confidence`}`}</title>
          </g>
        ))}
        {furniture.map((item) => {
          const width = Math.min(42, Math.max(2, item.size.x));
          const height = Math.min(30, Math.max(2, item.size.y));
          const label = item.label.toLowerCase();
          const glyph = label.includes("bed") ? "BED" : label.includes("table") ? "TABLE" : label.includes("sofa") || label.includes("chair") ? "SEAT" : item.label.toUpperCase().slice(0, 8);
          const dimensions = measuredDimension(item, scene);
          return (
            <g
              key={item.id}
              className="camera-map-furniture"
              transform={`translate(${bounded(item.center.x)} ${bounded(item.center.y)}) rotate(${item.rotationDegrees ?? 0})`}
              aria-label={item.label}
            >
              <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={Math.min(2.2, height / 4)} />
              <text x="0" y="0.9" textAnchor="middle">{glyph}</text>
              <title>{`${item.label}${dimensions ? ` · ${dimensions}` : ""}${item.confidence === undefined ? "" : ` · ${Math.round(item.confidence * 100)}% confidence`}`}</title>
            </g>
          );
        })}
        {measurement && measurement.points.length > 0 && (
          <g className="camera-map-measurement" pointerEvents="none">
            {measurement.points.length > 1 && <line x1={bounded(measurement.points[0].x)} y1={bounded(measurement.points[0].y)} x2={bounded(measurement.points[1].x)} y2={bounded(measurement.points[1].y)} />}
            {measurement.points.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={bounded(point.x)} cy={bounded(point.y)} r="1.9" />)}
            <text x={bounded(measurement.points[0].x) + 2} y={bounded(measurement.points[0].y) - 2}>REFERENCE {measurement.points.length}/2</text>
          </g>
        )}
        {scaleBar(scene) && (
          <g className="camera-map-scale-bar" transform="translate(7 91)" aria-label={`${scaleBar(scene)!.meters} metre scale bar`}>
            <line x1="0" y1="0" x2={scaleBar(scene)!.width} y2="0" />
            <line x1="0" y1="-1.5" x2="0" y2="1.5" />
            <line x1={scaleBar(scene)!.width} y1="-1.5" x2={scaleBar(scene)!.width} y2="1.5" />
            <text x={scaleBar(scene)!.width / 2} y="-2" textAnchor="middle">{scaleBar(scene)!.meters} m</text>
          </g>
        )}
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
          <strong>{scene.geometryStatus === "needs_rescan" ? "The room walkthrough needs another pass" : "Room context is optional"}</strong>
          <span>{scene.geometryStatus === "needs_rescan" ? "The camera remains saved and usable. Retry the walkthrough later if you want a better room draft." : "The camera works without a map. Record a short walkthrough later to add approximate room geometry."}</span>
        </div>
      )}
    </div>
  );
}
