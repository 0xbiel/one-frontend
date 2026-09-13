import { lazy, Suspense, useEffect, useState } from "react";
import { Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, demoMode, sceneFromMapResponse } from "../api/client";
import type { LastSeenObject, Scene } from "../models/domain";
import { CameraMap2D } from "../map/CameraMap2D";
import { hasRealLidarGeometry } from "../map/lidarGeometry";
import { formatTime } from "./shared";

const LiDARRoomScene3D = lazy(() => import("../map/LiDARRoomScene3D").then((module) => ({ default: module.LiDARRoomScene3D })));

function sourceLabel(scene: Scene): string {
  if (scene.source === "roomplan-lidar-3d") return "LIDAR ROOMPLAN MODEL";
  if (scene.source === "camera-cv-2d") return "CAMERA-DERIVED 2D MAP";
  return "MAP NEEDS A FRESH SWEEP";
}

function mapDescription(scene: Scene): string {
  if (scene.source === "roomplan-lidar-3d") return "A native iPhone or iPad LiDAR scan is providing this model.";
  if (scene.source === "camera-cv-2d") return "Generated from the camera sweep · relative geometry · not to scale.";
  return "The existing map is legacy data. Reconnect a camera to generate current geometry.";
}

function objectLocationCopy(object: LastSeenObject, metricScaleKnown: boolean): string {
  if (!object.point) return `Point is uncertain; showing the ${object.zone?.name ?? "nearest"} area instead.`;
  return metricScaleKnown
    ? `Estimated within ${object.confidenceRadiusM}m of this point.`
    : "Approximate camera-space position; no measured distance is claimed.";
}

export function MapPage({ objects, scene }: { objects: LastSeenObject[]; scene: Scene }) {
  const hasSession = demoMode || Boolean(sessionStorage.getItem("one_access_token"));
  const mapQuery = useQuery({ queryKey: ["current-map"], queryFn: api.getCurrentMap, enabled: hasSession, retry: false });
  const cameraQuery = useQuery({ queryKey: ["camera"], queryFn: api.getDevice, enabled: hasSession, retry: false });
  const [selected, setSelected] = useState(objects[0]?.id);
  const [view, setView] = useState<"3d" | "2d">("2d");
  const displayScene = mapQuery.data ? sceneFromMapResponse(mapQuery.data, scene) : scene;
  const hasReal3D = hasRealLidarGeometry(displayScene);
  const current = objects.find((object) => object.id === selected);

  useEffect(() => {
    if (!hasReal3D && view === "3d") setView("2d");
  }, [hasReal3D, view]);

  return (
    <div className="map-layout">
      <section className="map-panel panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{sourceLabel(displayScene)} · REVISION {mapQuery.data?.revision ?? displayScene.version}</span>
            <h2>Familiar places, gently remembered.</h2>
          </div>
          {hasReal3D && (
            <div className="view-toggle" aria-label="Map view">
              <button className={view === "3d" ? "active" : ""} onClick={() => setView("3d")}>3D</button>
              <button className={view === "2d" ? "active" : ""} onClick={() => setView("2d")}>2D</button>
            </div>
          )}
        </div>
        <div className="scene-wrap">
          {view === "3d" && hasReal3D ? (
            <Suspense fallback={<div className="three-scene loading-scene">Loading LiDAR model…</div>}>
              <LiDARRoomScene3D scene={displayScene} />
            </Suspense>
          ) : (
            <CameraMap2D scene={displayScene} objects={objects} selectedId={selected} onSelect={setSelected} />
          )}
          <div className="scene-legend">
            <span><i className="legend-dot precise" /> Estimated object position</span>
            <span><i className="legend-dot zone" /> Camera geometry</span>
            <span>{displayScene.metricScaleKnown ? "Measured RoomPlan scale" : "Relative view · scale not measured"}</span>
          </div>
          <div className="map-data-note" role="status">
            <strong>Map data</strong> · {mapDescription(displayScene)}{displayScene.modelVersion ? ` · model ${displayScene.modelVersion}` : ""}
            {displayScene.geometryStatus === "needs_rescan" ? " · fresh sweep required" : ""}
          </div>
        </div>
      </section>

      <aside className="map-side">
        <div className="panel selected-object">
          <span className="eyebrow">SELECTED MEMORY</span>
          {current ? (
            <>
              <div className="selected-title">
                <span className="object-symbol">{current.icon}</span>
                <div><h2>{current.label}</h2><span className="muted">Last seen {formatTime(current.lastSeenAt)}</span></div>
              </div>
              <div className="confidence-meter">
                <div><span>Confidence</span><strong>{Math.round(current.confidence * 100)}%</strong></div>
                <div className="meter"><span style={{ width: `${current.confidence * 100}%` }} /></div>
                <p>{objectLocationCopy(current, displayScene.metricScaleKnown)}</p>
              </div>
              <button className="secondary-button full-width"><Video size={16} /> View source clip</button>
            </>
          ) : <p className="muted">{displayScene.geometry?.polygons.length ? "Select an object on the map." : "Complete a camera sweep to add room geometry."}</p>}
        </div>

        <div className="panel calibration-card">
          <span className="eyebrow">FIXED CAMERA</span>
          <h3>{cameraQuery.data ? "Camera connection" : "No camera connected"}</h3>
          <p className="muted">{cameraQuery.data ? `${cameraQuery.data.label} · ${cameraQuery.data.status}` : "Connect a fixed camera to generate a 2D room view."}</p>
          {displayScene.source === "roomplan-lidar-3d" && hasReal3D ? (
            <p className="calibration-state" role="status"><strong>3D model:</strong> Native LiDAR RoomPlan geometry available.</p>
          ) : displayScene.source === "camera-cv-2d" ? (
            <p className="calibration-state" role="status"><strong>2D map:</strong> Camera-derived and approximate. 3D requires an iPhone or iPad with LiDAR.</p>
          ) : (
            <p className="calibration-state" role="status"><strong>2D map:</strong> No current camera geometry is available. Take a new guided sweep.</p>
          )}
          {!hasReal3D && <p className="muted small-copy">ONE hides 3D until a real native LiDAR RoomPlan model is saved.</p>}
        </div>
      </aside>
    </div>
  );
}
