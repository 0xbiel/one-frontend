import { lazy, Suspense, useEffect, useState } from "react";
import { Video } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, demoMode, sceneFromMapResponse } from "../api/client";
import type { LastSeenObject, Point2D, Scene } from "../models/domain";
import { CameraMap2D } from "../map/CameraMap2D";
import { hasRenderableSpatial3D } from "../map/lidarGeometry";
import { LocalizationTemporalTrace } from "../map/LocalizationTemporalTrace";
import { formatTime } from "./shared";

const LiDARRoomScene3D = lazy(() => import("../map/LiDARRoomScene3D").then((module) => ({ default: module.LiDARRoomScene3D })));
const RoomPlanFloorPlan2D = lazy(() => import("../map/RoomPlanFloorPlan2D").then((module) => ({ default: module.RoomPlanFloorPlan2D })));

function sourceLabel(scene: Scene): string {
  if (scene.source === "roomplan-lidar-3d") return "LIDAR ROOMPLAN MODEL";
  if (scene.source === "arkit-video-3d") return "ARKIT VIDEO 3D MODEL";
  if (scene.source === "camera-cv-2d") return "CAMERA-DERIVED 2D MAP";
  return "MAP NEEDS A FRESH SWEEP";
}

function mapDescription(scene: Scene): string {
  if (scene.source === "roomplan-lidar-3d") return "A native iPhone or iPad LiDAR scan is providing this model.";
  if (scene.source === "arkit-video-3d") return "Generated from a guided iPhone ARKit room video without LiDAR. Scale is metric, while structural geometry remains approximate.";
  if (scene.source === "camera-cv-2d") {
    return scene.scale
      ? `Generated from the room walkthrough · reference-calibrated to ${scene.scale.referenceLengthM} m · still approximate away from that reference.`
      : "Generated from the room walkthrough · add one measured wall, doorway, or object reference to set the scale.";
  }
  return "The existing map is legacy data. Continue camera setup when convenient to record a room walkthrough.";
}

function formatMeters(value: number): string {
  return `${value < 1 ? value.toFixed(2) : value.toFixed(1)} m`;
}

function objectLocationCopy(object: LastSeenObject, scene: Scene): string {
  if (!object.point) return `Point is uncertain; showing the ${object.zone?.name ?? "nearest"} area instead.`;
  if (scene.metricScaleKnown) return `Estimated within ${object.confidenceRadiusM}m of this point.`;
  return scene.scale
    ? `Reference-calibrated map position using ${scene.scale.referenceLabel}; still approximate in camera perspective.`
    : "Approximate camera-space position; add a measured reference to establish scale.";
}

export function MapPage({ objects, scene }: { objects: LastSeenObject[]; scene: Scene }) {
  const hasSession = demoMode || Boolean(sessionStorage.getItem("one_access_token"));
  const queryClient = useQueryClient();
  const sceneQuery = useQuery({
    queryKey: ["scene"],
    queryFn: api.getScene,
    enabled: hasSession,
    retry: false,
    refetchInterval: !demoMode && hasSession ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
  const objectsQuery = useQuery({
    queryKey: ["objects"],
    queryFn: api.getObjects,
    enabled: hasSession,
    retry: false,
    refetchInterval: !demoMode && hasSession ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
  const mapQuery = useQuery({
    queryKey: ["current-map"],
    queryFn: api.getCurrentMap,
    enabled: hasSession,
    retry: false,
    refetchInterval: !demoMode && hasSession ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
  const cameraQuery = useQuery({ queryKey: ["camera"], queryFn: api.getDevice, enabled: hasSession, retry: false });
  const [selected, setSelected] = useState<string | undefined>(objects[0]?.id);
  const [view, setView] = useState<"3d" | "2d">(hasRenderableSpatial3D(scene) ? "3d" : "2d");
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point2D[]>([]);
  const [referenceLength, setReferenceLength] = useState("1.00");
  const [referenceLabel, setReferenceLabel] = useState("Measured reference");
  const [scaleError, setScaleError] = useState("");
  const [savingScale, setSavingScale] = useState(false);
  const [savingLocalizationReference, setSavingLocalizationReference] = useState(false);
  const liveScene = sceneQuery.data ?? scene;
  const liveObjects = objectsQuery.data ?? objects;
  const displayScene = mapQuery.data ? sceneFromMapResponse(mapQuery.data, liveScene) : liveScene;
  const hasReal3D = hasRenderableSpatial3D(displayScene);
  const positionedCameraCount = (displayScene.cameraRegistrations?.length
    ? displayScene.cameraRegistrations
    : displayScene.cameraRegistration ? [displayScene.cameraRegistration] : [])
    .filter((registration) => registration.status === "positioned").length;
  const localizationCameraId = (displayScene.cameraRegistrations?.length
    ? displayScene.cameraRegistrations.find((registration) => registration.cameraId)?.cameraId
    : displayScene.cameraRegistration?.cameraId) ?? cameraQuery.data?.id ?? null;
  const localizationHistoryQuery = useQuery({
    queryKey: ["camera-localization-history", localizationCameraId],
    queryFn: () => api.getCameraLocalizationHistory(localizationCameraId!),
    enabled: hasSession && displayScene.source === "roomplan-lidar-3d" && Boolean(localizationCameraId),
    retry: false,
    refetchInterval: !demoMode && hasSession ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
  const current = liveObjects.find((object) => object.id === selected);
  const canMeasureScale = displayScene.source === "camera-cv-2d" && Boolean(displayScene.mapId);

  useEffect(() => {
    setView(hasReal3D ? "3d" : "2d");
  }, [displayScene.mapId, hasReal3D]);

  useEffect(() => {
    if (!liveObjects.length) {
      setSelected(undefined);
      return;
    }
    if (!selected || !liveObjects.some((object) => object.id === selected)) {
      setSelected(liveObjects[0].id);
    }
  }, [liveObjects, selected]);

  const handleMeasurePoint = (point: Point2D) => {
    setScaleError("");
    setMeasurePoints((currentPoints) => currentPoints.length >= 2 ? [point] : [...currentPoints, point]);
  };

  const startMeasuring = () => {
    setScaleError("");
    setMeasurePoints([]);
    setMeasureMode(true);
  };

  const cancelMeasuring = () => {
    setMeasureMode(false);
    setMeasurePoints([]);
    setScaleError("");
  };

  const saveScale = async () => {
    if (!displayScene.mapId || measurePoints.length !== 2) return;
    const length = Number(referenceLength);
    if (!Number.isFinite(length) || length <= 0.05) {
      setScaleError("Enter a real reference length greater than 0.05 m.");
      return;
    }
    if (!referenceLabel.trim()) {
      setScaleError("Name the reference so the measurement can be understood later.");
      return;
    }
    setSavingScale(true);
    setScaleError("");
    try {
      await api.measureMapScale(displayScene.mapId, {
        start: { x: measurePoints[0].x / 100, y: measurePoints[0].y / 100 },
        end: { x: measurePoints[1].x / 100, y: measurePoints[1].y / 100 },
        length_m: length,
        label: referenceLabel.trim(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["current-map"] }),
        queryClient.invalidateQueries({ queryKey: ["scene"] }),
      ]);
      cancelMeasuring();
    } catch {
      setScaleError("The measured scale could not be saved. Nothing was changed.");
    } finally {
      setSavingScale(false);
    }
  };

  const saveLocalizationReference = async (point: { x: number; z: number }) => {
    if (!localizationCameraId) return;
    setSavingLocalizationReference(true);
    try {
      await api.setCameraLocalizationReference(localizationCameraId, { ...point, source: "manual-floor-reference" });
      await queryClient.invalidateQueries({ queryKey: ["camera-localization-history", localizationCameraId] });
    } finally {
      setSavingLocalizationReference(false);
    }
  };

  return (
    <div className="map-page">
      <header className="page-heading-clean map-page-heading">
        <span className="eyebrow">HOME MAP</span>
        <h2>Home map</h2>
        <p>Review room geometry, camera context, and approximate last-seen locations in one place.</p>
      </header>
      <div className="map-layout">
      <section className="map-panel panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{sourceLabel(displayScene)} · REVISION {mapQuery.data?.revision ?? displayScene.version}</span>
            <h2>Map view</h2>
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
            <Suspense fallback={<div className="three-scene loading-scene">Loading 3D room model…</div>}>
              <LiDARRoomScene3D scene={displayScene} objects={liveObjects} />
            </Suspense>
          ) : hasReal3D ? (
            <Suspense fallback={<div className="three-scene loading-scene">Building native floor plan…</div>}>
              <RoomPlanFloorPlan2D scene={displayScene} objects={liveObjects} />
            </Suspense>
          ) : (
            <CameraMap2D scene={displayScene} objects={liveObjects} selectedId={selected} onSelect={setSelected} measurement={measureMode ? { points: measurePoints, onPoint: handleMeasurePoint } : undefined} />
          )}
          <div className="scene-legend">
            {hasReal3D ? (
              <>
                <span><i className="legend-dot precise" /> {displayScene.source === "roomplan-lidar-3d" ? "Native RoomPlan geometry" : "ARKit structural geometry"}</span>
                {displayScene.source === "roomplan-lidar-3d" ? <span><i className="legend-dot fixture" /> Furniture</span> : null}
                {displayScene.source === "roomplan-lidar-3d" ? <span><i className="legend-dot opening" /> Door & window openings</span> : null}
                {displayScene.source === "roomplan-lidar-3d" ? <span><i className="legend-dot zone" /> Registered camera</span> : null}
                <span>Person markers remain visible for 12 s after the latest detection</span>
              </>
            ) : (
              <>
                <span><i className="legend-dot precise" /> Estimated object position</span>
                <span><i className="legend-dot zone" /> Camera geometry</span>
                {displayScene.geometry?.furniture?.length ? <span><i className="legend-dot fixture" /> Furniture</span> : null}
                {displayScene.geometry?.openings?.length ? <span><i className="legend-dot opening" /> Doors & windows</span> : null}
              </>
            )}
            <span>{displayScene.metricScaleKnown ? (displayScene.source === "arkit-video-3d" ? "ARKit metric world scale · approximate geometry" : "Measured RoomPlan scale") : displayScene.scale ? `Measured reference · ${formatMeters(displayScene.scale.referenceLengthM)}` : "Scale not measured · measure a reference"}</span>
          </div>
          <div className="map-data-note" role="status">
            <strong>Map data</strong> · {mapDescription(displayScene)}{displayScene.modelVersion ? ` · model ${displayScene.modelVersion}` : ""}
            {displayScene.geometryStatus === "needs_rescan" ? " · fresh sweep required" : ""}
            {displayScene.source === "camera-cv-2d" && !displayScene.geometry?.furniture?.length && !displayScene.geometry?.openings?.length ? " · Run a fresh sweep to add detected furniture, doors, and windows." : ""}
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
                <p>{objectLocationCopy(current, displayScene)}</p>
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
            positionedCameraCount > 0 ? (
              <p className="calibration-state" role="status"><strong>3D camera:</strong> {positionedCameraCount} fixed camera{positionedCameraCount === 1 ? " is" : "s are"} positioned in the RoomPlan map.</p>
            ) : (
              <p className="calibration-state" role="status"><strong>3D camera:</strong> LiDAR geometry is ready, but the fixed camera is not positioned yet. Keep its publisher view open while a fresh scan builds visual landmarks; ONE will retry placement automatically.</p>
            )
          ) : displayScene.source === "arkit-video-3d" && hasReal3D ? (
            <p className="calibration-state" role="status"><strong>3D map:</strong> ARKit video geometry is ready. Fixed camera setup can be completed later and is not required for this room model.</p>
          ) : displayScene.source === "camera-cv-2d" ? (
            <p className="calibration-state" role="status"><strong>2D map:</strong> Camera-derived and approximate. A native iPhone scan can add 3D using RoomPlan/LiDAR or the guided ARKit video fallback.</p>
          ) : (
            <p className="calibration-state" role="status"><strong>2D map:</strong> No current camera geometry is available. Take a new guided sweep.</p>
          )}
          {!hasReal3D && <p className="muted small-copy">ONE shows 3D after either a validated native RoomPlan scan or a guided ARKit room video has been saved.</p>}
        </div>

        {displayScene.source === "roomplan-lidar-3d" && localizationCameraId ? (
          <LocalizationTemporalTrace
            history={localizationHistoryQuery.data}
            loading={localizationHistoryQuery.isLoading}
            savingReference={savingLocalizationReference}
            onSetReference={saveLocalizationReference}
          />
        ) : null}

        <div className="panel scale-card">
          <span className="eyebrow">MAP SCALE</span>
          <h3>{displayScene.scale ? "Reference scale saved" : "Measure one reference"}</h3>
          <p className="muted">Click two points on a visible wall, doorway, or known object, then enter its real length. This makes furniture and opening dimensions readable without inventing scale from RGB alone.</p>
          {displayScene.scale && !measureMode ? (
            <p className="calibration-state" role="status"><strong>{displayScene.scale.referenceLabel}:</strong> {formatMeters(displayScene.scale.referenceLengthM)} measured · reference-calibrated 2D map.</p>
          ) : null}
          {!measureMode ? (
            <button className="secondary-button full-width" onClick={startMeasuring} disabled={!canMeasureScale}>Measure map scale</button>
          ) : (
            <div className="scale-form">
              <p className="scale-step" role="status">Click two points on the map. {measurePoints.length}/2 selected; clicking after two points starts over.</p>
              <label>Reference name<input value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} placeholder="e.g. hallway door" /></label>
              <label>Actual length (metres)<input type="number" min="0.05" step="0.01" value={referenceLength} onChange={(event) => setReferenceLength(event.target.value)} /></label>
              <div className="scale-actions">
                <button className="secondary-button" onClick={cancelMeasuring}>Cancel</button>
                <button className="primary-button" onClick={() => void saveScale()} disabled={savingScale || measurePoints.length !== 2}>{savingScale ? "Saving…" : "Save measured scale"}</button>
              </div>
              {scaleError && <div className="error-note" role="alert">{scaleError}</div>}
            </div>
          )}
          {!canMeasureScale && <p className="muted small-copy">A camera-derived 2D map is required. Native RoomPlan and ARKit video 3D maps already carry metric scale.</p>}
        </div>
      </aside>
      </div>
    </div>
  );
}
