import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  LockKeyhole,
  Map,
  Pause,
  Play,
  RotateCcw,
  Video,
} from "lucide-react";
import { api, demoMode } from "../api/client";
import type { CameraLocalizationProgress, CameraLocalizationResponse, MapGenerationFrame, RoomPlanCalibrationSession } from "../api/client";
import type { PublisherConnection } from "../livekit/publisher";
import type { CameraRegistration, Scene } from "../models/domain";
import {
  clearPublisherRegistry,
  registerPublisherConnection,
  registerPublisherStream,
  stopActivePublisher,
} from "../livekit/registry";
import { describeCameraError, describeCameraLocalizationError, describeLiveKitError } from "./errors";
import {
  captureCurrentCameraFrame,
  captureFixedCameraFrames,
  captureRoomSweep,
  preferredCameraConstraints,
  ROOM_SWEEP_DURATION_MS,
  ROOM_SWEEP_FRAME_COUNT,
} from "./roomSweep";
import { useMapGeneration } from "./useMapGeneration";

const RoomPlanFloorPlan2D = lazy(() => import("../map/RoomPlanFloorPlan2D").then((module) => ({ default: module.RoomPlanFloorPlan2D })));

type CameraSetupCardProps = {
  embedded?: boolean;
  paused?: boolean;
  onTogglePause?: () => void;
};

type SweepPhase = "idle" | "preview" | "sweeping" | "submitting" | "processing" | "place-camera" | "localizing" | "review-placement" | "manual-placement" | "saving-placement" | "ready" | "needs-rescan" | "unavailable" | "failed";

type ManualPlacement = {
  x: number;
  z: number;
  floorY: number;
  heightM: number;
  yawDeg: number;
  tiltDeg: number;
};

const setupSteps = ["Consent", "Preview", "Ready"];

function stageFor(consented: boolean, phase: SweepPhase): number {
  if (!consented) return 0;
  if (phase === "idle") return 1;
  if (phase === "preview") return 2;
  if (["sweeping", "submitting", "processing", "place-camera", "localizing", "review-placement", "manual-placement", "saving-placement", "ready", "needs-rescan", "unavailable", "failed"].includes(phase)) return 2;
  return 1;
}

function stepClass(index: number, current: number): string {
  if (index < current) return "complete";
  if (index === current) return "current";
  return "";
}

function phaseCopy(phase: SweepPhase): { title: string; description: string } {
  switch (phase) {
    case "preview":
      return { title: "Keep this camera fixed. Map when you are ready.", description: "The camera is already paired and can publish now. A 2D walkthrough is optional; after an iPhone LiDAR scan, ONE can position this fixed view directly inside the 3D RoomPlan map." };
    case "sweeping":
      return { title: "Walk ONE around the room.", description: "Move naturally around the room and turn slowly through the corners. Include the floor-wall boundary and large furniture; you do not need to hold the phone perfectly still." };
    case "submitting":
    case "processing":
      return { title: "Building a room draft.", description: "The local room-layout service is turning the walkthrough into approximate camera geometry. The camera stays paired even if this draft needs another pass." };
    case "place-camera":
      return { title: "Camera preview is ready.", description: "Keep this device in its fixed spot. Room walkthrough and 3D positioning are optional tools you run only when you choose them." };
    case "localizing":
      return { title: "Finding this camera in 3D.", description: "Keep the camera still while ONE compares short reference views with the private RoomPlan landmark index. People and movable chairs are masked from calibration." };
    case "review-placement":
      return { title: "Check where ONE placed the camera.", description: "The automatic result is only a proposal. Confirm it on the top-down RoomPlan map, or move it manually before anything is saved as the camera position." };
    case "manual-placement":
      return { title: "Place the camera yourself.", description: "Click the camera's real position on the map, then adjust its viewing direction and height. The amber camera is only a preview until you save it." };
    case "saving-placement":
      return { title: "Saving the reviewed camera position.", description: "ONE is applying the position you just confirmed to the active RoomPlan map." };
    case "ready":
      return { title: "Camera setup is ready.", description: "Object vision can run locally now. Keep this camera fixed, scan the room with the iPhone LiDAR app, then match this live view into the metric 3D RoomPlan map." };
    default:
      return { title: "A clear view, with consent.", description: "Give ONE permission only after you know what this device will share. Pairing is already saved separately from room mapping." };
  }
}

function pointInPolygon(point: { x: number; z: number }, polygon: Array<{ x: number; z: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.z > point.z) !== (b.z > point.z))
      && point.x < ((b.x - a.x) * (point.z - a.z)) / ((b.z - a.z) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function floorYForPoint(scene: Scene, point: { x: number; z: number }): number {
  const zones = scene.geometry?.roomZones ?? [];
  const containing = zones.find((zone) => pointInPolygon(point, zone.polygon));
  return containing?.floorY ?? zones[0]?.floorY ?? 0;
}

function poseFromMatrix(scene: Scene, matrix: number[][]): ManualPlacement {
  const x = Number(matrix[0]?.[3] ?? 0);
  const z = Number(matrix[2]?.[3] ?? 0);
  const floorY = floorYForPoint(scene, { x, z });
  const y = Number(matrix[1]?.[3] ?? floorY + 1.2);
  const forwardX = -Number(matrix[0]?.[2] ?? 0);
  const forwardY = -Number(matrix[1]?.[2] ?? 0);
  const forwardZ = -Number(matrix[2]?.[2] ?? 1);
  const yawDeg = Math.atan2(forwardX, -forwardZ) * 180 / Math.PI;
  const tiltDeg = Math.asin(Math.max(-1, Math.min(1, -forwardY))) * 180 / Math.PI;
  const heightM = Math.max(0.2, Math.min(3.5, y - floorY));
  return { x, z, floorY, heightM, yawDeg, tiltDeg };
}

function matrixFromManualPlacement(placement: ManualPlacement): number[][] {
  const yaw = placement.yawDeg * Math.PI / 180;
  const tilt = placement.tiltDeg * Math.PI / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return [
    [c, s * st, -s * ct, placement.x],
    [0, ct, st, placement.floorY + placement.heightM],
    [s, -c * st, c * ct, placement.z],
    [0, 0, 0, 1],
  ];
}

function defaultManualPlacement(scene: Scene): ManualPlacement {
  const zone = scene.geometry?.roomZones?.[0];
  const polygon = zone?.polygon ?? [];
  const x = polygon.length ? polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length : 0;
  const z = polygon.length ? polygon.reduce((sum, point) => sum + point.z, 0) / polygon.length : 0;
  return { x, z, floorY: zone?.floorY ?? 0, heightM: 1.2, yawDeg: 0, tiltDeg: 0 };
}

function cameraIdFromSession(): Promise<string | null> {
  return api.getSession().then(async (session) => {
    // A publisher's user identity is the camera identity created by pairing.
    // Do not fall back to /me's first household camera when several devices
    // are configured; that would attach this sweep to the wrong device.
    if (session.actor.role === "publisher") return session.actor.id;
    if (session.device?.id) return session.device.id;
    return (await api.getDevice())?.id ?? null;
  });
}

export function CameraSetupCard({ embedded = false, paused = false, onTogglePause }: CameraSetupCardProps) {
  const [consented, setConsented] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connection, setConnection] = useState<PublisherConnection | null>(null);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState<SweepPhase>("idle");
  const [sweepProgress, setSweepProgress] = useState(0);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [mapError, setMapError] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [placementProposal, setPlacementProposal] = useState<CameraLocalizationResponse | null>(null);
  const [placementScene, setPlacementScene] = useState<Scene | null>(null);
  const [manualPlacement, setManualPlacement] = useState<ManualPlacement | null>(null);
  const [pendingReferenceFrame, setPendingReferenceFrame] = useState<MapGenerationFrame | null>(null);
  const [savingReference, setSavingReference] = useState(false);
  const [remoteCalibration, setRemoteCalibration] = useState<RoomPlanCalibrationSession | null>(null);
  const [localizationProgress, setLocalizationProgress] = useState<CameraLocalizationProgress | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sweepControllerRef = useRef<AbortController | null>(null);
  const remoteCalibrationCaptureRef = useRef<string | null>(null);
  const remoteReferenceCaptureRef = useRef<string | null>(null);
  const generationQuery = useMapGeneration(cameraId ?? undefined, jobId ?? undefined);
  const setupStage = stageFor(consented, phase);
  const copy = phaseCopy(phase);
  const previewMatrix = manualPlacement
    ? matrixFromManualPlacement(manualPlacement)
    : placementProposal?.camera_to_world ?? null;
  const previewRegistration: CameraRegistration | null = previewMatrix && placementScene?.mapId && cameraId
    ? {
        status: "positioned",
        cameraId,
        mapId: placementScene.mapId,
        coordinateFrame: "roomplan-local",
        cameraToWorld: previewMatrix,
        confidence: placementProposal?.confidence ?? null,
        trackingState: "normal",
        source: "placement-preview",
      }
    : null;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (!stream) return;
    try {
      void video.play().catch(() => undefined);
    } catch {
      // Safari can throw synchronously while a permission prompt is settling.
    }
  }, [stream]);

  useEffect(() => {
    const result = generationQuery.data;
    if (!result) return;
    if (result.status === "ready") {
      setPhase("place-camera");
      setMapError("");
    } else if (result.status === "needs_rescan") {
      setPhase("needs-rescan");
      setMapError(result.error ?? "The walkthrough did not produce a confident room draft. The camera is still saved; retry only if you want better spatial context.");
    } else if (result.status === "unavailable") {
      setPhase("unavailable");
      setMapError(result.error ?? "Room mapping is unavailable right now. The paired camera can still be used without a map.");
    } else if (result.status === "failed") {
      setPhase("failed");
      setMapError(result.error ?? "The room draft could not be built, but the paired camera was not lost.");
    } else {
      setPhase("processing");
    }
  }, [generationQuery.data]);

  useEffect(() => {
    if (!cameraId || demoMode) return;
    let disposed = false;
    let running = false;
    const tick = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const request = await api.getCameraReferenceCaptureRequest(cameraId);
        if (disposed || !request || request.status !== "capture_requested") {
          if (!request || request?.status === "captured" || request?.status === "expired") remoteReferenceCaptureRef.current = null;
          return;
        }
        if (remoteReferenceCaptureRef.current === request.request_id) return;
        if (!stream || !videoRef.current) {
          setConnectionNotice("The iPhone requested a fresh reference photo. Start this camera preview to capture it from the fixed position.");
          return;
        }
        remoteReferenceCaptureRef.current = request.request_id;
        try {
          setConnectionNotice("Capturing the fixed camera's refreshed reference view…");
          const [frame] = await captureFixedCameraFrames(videoRef.current, stream, { frameCount: 1, durationMs: 120 });
          if (!frame) throw new Error("REFERENCE_CAPTURE_EMPTY");
          await api.saveCameraReferenceSnapshot(cameraId, frame);
          if (!disposed) setConnectionNotice("Reference view refreshed. The map will use this photo as the camera's latest visual memory.");
        } catch (error) {
          if (remoteReferenceCaptureRef.current === request.request_id) remoteReferenceCaptureRef.current = null;
          throw error;
        }
      } catch (error) {
        if (!disposed && error instanceof Error && error.message !== "API_404") {
          setConnectionNotice("The requested reference photo could not be captured yet. Keep the fixed camera preview open and try again.");
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const interval = window.setInterval(() => { void tick(); }, 1_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [cameraId, stream]);

  useEffect(() => {
    if (!cameraId || demoMode || phase !== "localizing") return;
    let disposed = false;
    let running = false;
    const tick = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const progress = await api.getRoomPlanLocalizationProgress(cameraId);
        if (disposed || !progress) return;
        setLocalizationProgress(progress);
        if (progress.status === "failed" && progress.error) setConnectionNotice(progress.error);
      } catch (error) {
        if (!disposed && error instanceof Error && error.message !== "API_404") {
          setConnectionNotice("Camera localization is still running; the latest solver progress is temporarily unavailable.");
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const interval = window.setInterval(() => { void tick(); }, 700);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [cameraId, phase]);

  useEffect(() => {
    if (!generationQuery.isError || !cameraId || !jobId) return;
    setPhase("failed");
    setMapError(describeCameraError(generationQuery.error));
  }, [cameraId, generationQuery.error, generationQuery.isError, jobId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resolvedCameraId = await cameraIdFromSession();
        if (cancelled || !resolvedCameraId) return;
        setCameraId(resolvedCameraId);
      } catch {
        // Pairing/session recovery is best-effort. Spatial work is deliberately
        // user-triggered, so stale walkthrough/calibration state is not restored
        // into the setup UI on page load.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cameraId || demoMode) return;
    let disposed = false;
    let running = false;
    const tick = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const session = await api.getRoomPlanCalibrationSession(cameraId);
        if (disposed) return;
        setRemoteCalibration(session);
        if (!session) {
          remoteCalibrationCaptureRef.current = null;
          setConnectionNotice((current) => (
            current.startsWith("iPhone-guided calibration") || current.startsWith("The iPhone calibration session")
              ? ""
              : current
          ));
          return;
        }
        setMapError("");
        if (session.status === "capture_requested") {
          const captureKey = `${session.session_id}:${session.current_target_index}:${session.capture_request_seq}`;
          if (remoteCalibrationCaptureRef.current === captureKey) return;
          if (!stream || !videoRef.current) {
            setConnectionNotice(`The iPhone requested reference view ${session.current_target_index + 1} of ${session.capture_round_count}. Start this camera preview so the fixed camera can capture it.`);
            return;
          }
          remoteCalibrationCaptureRef.current = captureKey;
          try {
            setConnectionNotice(`iPhone-guided calibration · capturing reference view ${session.current_target_index + 1} of ${session.capture_round_count}…`);
            // Four short samples per requested reference view keep the camera
            // fixed while giving temporal consensus enough evidence to reject
            // wandering repeated-texture matches. Three rounds stay within the
            // backend's sixteen-frame transient calibration limit.
            const burst = await captureFixedCameraFrames(videoRef.current, stream, { frameCount: 4, durationMs: 1_200 });
            const updated = await api.submitRoomPlanCalibrationFrames(cameraId, session.current_target_index, burst);
            if (disposed) return;
            setRemoteCalibration(updated);
            if (updated.status === "review") {
              setConnectionNotice("iPhone-guided calibration solved the camera pose. Review and save the placement on the iPhone.");
            } else if (updated.status === "failed" || updated.status === "expired") {
              setConnectionNotice(updated.error ?? "iPhone-guided calibration needs another attempt.");
            } else if (updated.status === "solving") {
              const progress = Math.max(1, Math.min(100, updated.solve_progress ?? 1));
              setConnectionNotice(`iPhone-guided calibration · ${progress}% · ${updated.solve_stage ?? "Matching the fixed view to RoomPlan"}. Keep the camera still.`);
            } else if (updated.status === "waiting_for_scene" && updated.error) {
              setConnectionNotice(updated.error);
            } else {
              setConnectionNotice(`Reference view ${session.current_target_index + 1} captured. Request the next fixed-camera view from the iPhone.`);
            }
          } catch (error) {
            if (remoteCalibrationCaptureRef.current === captureKey) remoteCalibrationCaptureRef.current = null;
            throw error;
          }
        } else if (session.status === "solving") {
          const progress = Math.max(1, Math.min(100, session.solve_progress ?? 1));
          setConnectionNotice(`iPhone-guided calibration · ${progress}% · ${session.solve_stage ?? "Matching the fixed view to RoomPlan"}. Keep the camera still.`);
        } else if (session.status === "review") {
          setConnectionNotice("iPhone-guided calibration solved the camera pose. Review and save the placement on the iPhone.");
        } else if (session.status === "failed" || session.status === "expired") {
          setConnectionNotice(session.error ?? "iPhone-guided calibration needs another attempt.");
        }
      } catch (error) {
        if (!disposed && error instanceof Error && error.message !== "API_404") {
          setConnectionNotice("The iPhone calibration session could not be refreshed. The camera preview is still available.");
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const interval = window.setInterval(() => { void tick(); }, 1_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [cameraId, stream]);

  useEffect(() => {
    const visionCanRun = ["preview", "place-camera", "ready", "needs-rescan", "unavailable", "failed"].includes(phase);
    if (!stream || !cameraId || !visionCanRun || paused || demoMode) return;
    let disposed = false;
    let running = false;
    const tick = async () => {
      if (disposed || running || !videoRef.current) return;
      running = true;
      try {
        const frame = captureCurrentCameraFrame(videoRef.current, 640, 0.58);
        await api.submitVisionFrame(cameraId, frame);
        setConnectionNotice((current) =>
          current === "Live video is connected, but the local object-vision worker is unavailable."
            ? ""
            : current,
        );
      } catch (error) {
        if (!disposed && error instanceof Error && error.message === "API_503") {
          setConnectionNotice("Live video is connected, but the local object-vision worker is unavailable.");
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const interval = window.setInterval(() => { void tick(); }, 1_400);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [cameraId, paused, phase, stream]);

  const stop = () => {
    sweepControllerRef.current?.abort();
    sweepControllerRef.current = null;
    stopActivePublisher();
    setStream(null);
    setConnection(null);
    if (["idle", "preview", "sweeping", "submitting", "review-placement", "manual-placement", "saving-placement", "needs-rescan", "unavailable", "failed"].includes(phase)) {
      setPhase("idle");
      setSweepProgress(0);
      setPlacementProposal(null);
      setManualPlacement(null);
      setPendingReferenceFrame(null);
    }
  };

  const start = async () => {
    if (starting || stream || !consented) return;
    setStarting(true);
    setMapError("");
    setConnectionNotice("");
    try {
      if (!demoMode && typeof window !== "undefined" && window.isSecureContext === false) throw new Error("SECURE_CONTEXT_REQUIRED");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("SECURE_CONTEXT_REQUIRED");
      const media = await navigator.mediaDevices.getUserMedia(preferredCameraConstraints());
      registerPublisherStream(media);
      setStream(media);
      setPhase((current) => current === "place-camera" || current === "ready" || current === "processing" ? current : "preview");
      if (!demoMode) {
        try {
          await api.giveConsent("video_capture", true);
          await api.giveConsent("audio_capture", true);
          const livekit = await api.getLiveKitToken("publish");
          if (livekit.url && livekit.token) {
            const { connectPublisher } = await import("../livekit/publisher");
            const liveConnection = await connectPublisher(livekit.url, livekit.token, media);
            registerPublisherConnection(liveConnection.disconnect);
            setConnection(liveConnection);
          }
        } catch {
          setConnectionNotice(describeLiveKitError());
        }
      }
    } catch (error) {
      stopActivePublisher();
      setStream(null);
      setConnection(null);
      setPhase("failed");
      setMapError(describeCameraError(error));
    } finally {
      setStarting(false);
    }
  };

  const recordWalkthrough = async () => {
    if (!stream || !videoRef.current || phase === "sweeping" || phase === "submitting" || phase === "processing") return;
    const controller = new AbortController();
    sweepControllerRef.current?.abort();
    sweepControllerRef.current = controller;
    setMapError("");
    setConnectionNotice("");
    setSweepProgress(0);
    try {
      setPhase("sweeping");
      const capture = await captureRoomSweep(videoRef.current, stream, {
        frameCount: ROOM_SWEEP_FRAME_COUNT,
        durationMs: demoMode ? 320 : ROOM_SWEEP_DURATION_MS,
        signal: controller.signal,
        onProgress: (captured, total) => setSweepProgress(Math.round((captured / total) * 100)),
      });
      if (controller.signal.aborted) return;
      setPhase("submitting");
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const generation = await api.startMapGeneration(resolvedCameraId, {
        room_label: "Room",
        orientation: capture.orientation,
        resolution_width: capture.resolutionWidth,
        resolution_height: capture.resolutionHeight,
      });
      if (controller.signal.aborted) return;
      setJobId(generation.job_id);
      await api.submitMapGenerationFrames(
        resolvedCameraId,
        generation.job_id,
        capture.frames.map(({ frame_base64, width, height, captured_at }) => ({ frame_base64, width, height, captured_at })),
      );
      if (controller.signal.aborted) return;
      setPhase(generation.status === "ready" ? "place-camera" : "processing");
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase("failed");
      setMapError(describeCameraError(error));
    } finally {
      if (sweepControllerRef.current === controller) sweepControllerRef.current = null;
    }
  };

  const retrySweep = () => {
    setMapError("");
    setJobId(null);
    setSweepProgress(0);
    setPhase(stream ? "preview" : "idle");
  };

  const continueWithoutMap = () => {
    setMapError("");
    setConnectionNotice("Camera saved and ready without a room map. You can record a walkthrough later to add spatial context.");
    setPhase("ready");
  };

  const loadPlacementScene = useCallback(async (resolvedCameraId?: string): Promise<Scene> => {
    const targetCameraId = resolvedCameraId ?? cameraId ?? await cameraIdFromSession();
    if (!targetCameraId) throw new Error("CAMERA_NOT_REGISTERED");
    if (targetCameraId !== cameraId) setCameraId(targetCameraId);
    const scene = await api.getRoomPlanPlacementPreview(targetCameraId);
    if (scene.source !== "roomplan-lidar-3d" || !scene.mapId) throw new Error("ROOMPLAN_MAP_REQUIRED");
    setPlacementScene(scene);
    return scene;
  }, [cameraId]);

  const loadPlacementUSDZ = useCallback(async (): Promise<ArrayBuffer> => {
    const targetCameraId = cameraId ?? await cameraIdFromSession();
    if (!targetCameraId) throw new Error("CAMERA_NOT_REGISTERED");
    return api.getRoomPlanPlacementPreviewUSDZ(targetCameraId);
  }, [cameraId]);

  const beginManualPlacement = useCallback(async () => {
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const scene = placementScene ?? await loadPlacementScene(resolvedCameraId);
      const currentRegistration = (scene.cameraRegistrations?.length
        ? scene.cameraRegistrations.find((registration) => registration.cameraId === resolvedCameraId)
        : scene.cameraRegistration?.cameraId === resolvedCameraId ? scene.cameraRegistration : null) ?? null;
      const baseMatrix = placementProposal?.camera_to_world ?? currentRegistration?.cameraToWorld ?? null;
      setManualPlacement(baseMatrix ? poseFromMatrix(scene, baseMatrix) : defaultManualPlacement(scene));
      setPhase("manual-placement");
      setConnectionNotice("Manual placement mode is active. Click the camera's real position on the map, then adjust direction and height before saving.");
    } catch (error) {
      setMapError(error instanceof Error && error.message === "ROOMPLAN_MAP_REQUIRED"
        ? "A native RoomPlan 3D map is required before the camera can be positioned manually."
        : describeCameraError(error));
    }
  }, [cameraId, loadPlacementScene, placementProposal, placementScene]);

  const saveReviewedPlacement = useCallback(async (matrix: number[][], confidence: number | null | undefined) => {
    const resolvedCameraId = cameraId ?? await cameraIdFromSession();
    if (!resolvedCameraId || !placementScene?.mapId) return;
    setPhase("saving-placement");
    setMapError("");
    try {
      const saved = await api.registerRoomPlanCamera({
        camera_id: resolvedCameraId,
        map_id: placementScene.mapId,
        camera_to_world: matrix,
        confidence: confidence ?? null,
        tracking_state: "normal",
      });
      if (saved.status !== "positioned") throw new Error("CAMERA_POSITION_NOT_ACCEPTED");
      let referenceSaved = false;
      if (pendingReferenceFrame) {
        try {
          await api.saveCameraReferenceSnapshot(resolvedCameraId, pendingReferenceFrame);
          referenceSaved = true;
        } catch {
          referenceSaved = false;
        }
      }
      setPlacementProposal(null);
      setManualPlacement(null);
      setPendingReferenceFrame(null);
      setConnectionNotice(referenceSaved
        ? "Camera position confirmed. The reviewed fixed-camera reference view is saved with the RoomPlan placement."
        : "Camera position confirmed. The reference view could not be saved, but you can refresh it later without recalibrating the camera.");
      setPhase("ready");
    } catch (error) {
      setPhase(manualPlacement ? "manual-placement" : "review-placement");
      setMapError(error instanceof Error && error.message === "CAMERA_POSITION_NOT_ACCEPTED"
        ? "That camera position could not be saved. Adjust it and try again."
        : describeCameraError(error));
    }
  }, [cameraId, manualPlacement, pendingReferenceFrame, placementScene]);

  const confirmPlacement = useCallback(async (automatic = false): Promise<boolean> => {
    if (!stream || !videoRef.current) return false;
    setPhase("localizing");
    setConnectionNotice("Starting camera localization… Keep the camera still while the local GPU-backed solver prepares the reference frames.");
    setLocalizationProgress({ camera_id: cameraId ?? "", status: "solving", progress: 1, stage: "Preparing fixed-camera reference frames", raw_frames_persisted: false });
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const frames = await captureFixedCameraFrames(videoRef.current, stream, { frameCount: 6, durationMs: demoMode ? 120 : 1_600 });
      setPendingReferenceFrame(frames.at(-1) ?? null);
      const localization = await api.localizeRoomPlanCamera(resolvedCameraId, frames, true);
      setLocalizationProgress(null);
      if (localization.status !== "positioned" || !localization.camera_to_world) {
        setPlacementProposal(null);
        const matchCount = Number(localization.match_count);
        const inlierCount = Number(localization.inlier_count);
        const reprojectionError = Number(localization.reprojection_error_px);
        const descriptorFamilies = localization.diagnostics?.descriptor_families;
        const siftLandmarkCount = descriptorFamilies && typeof descriptorFamilies === "object" && "sift_landmark_count" in descriptorFamilies
          ? Number((descriptorFamilies as { sift_landmark_count?: unknown }).sift_landmark_count)
          : null;
        const legacyVisualIndex = descriptorFamilies && typeof descriptorFamilies === "object" && "legacy_visual_index" in descriptorFamilies
          ? Boolean((descriptorFamilies as { legacy_visual_index?: unknown }).legacy_visual_index)
          : typeof siftLandmarkCount === "number" && Number.isFinite(siftLandmarkCount) && siftLandmarkCount === 0;
        const evidence = Number.isFinite(matchCount) && matchCount > 0
          ? ` The solver found ${Number.isFinite(inlierCount) ? inlierCount : 0} stable landmark${inlierCount === 1 ? "" : "s"} from ${matchCount} matches${Number.isFinite(reprojectionError) ? ` at ${reprojectionError.toFixed(1)} px reprojection error` : ""}, but that was not enough to trust a 3D pose.`
          : " The fixed view did not produce enough usable landmark matches to trust a 3D pose.";
        const indexGuidance = legacyVisualIndex
          ? " This RoomPlan visual index has no scale-robust SIFT descriptors; rescan it with the current iPhone app before retrying for stronger matching."
          : "";
        setConnectionNotice(`Localization finished at 100%, but automatic 3D placement was not confident enough to propose a position.${evidence}${indexGuidance} The camera position was not changed; retry with the camera still or place it manually on the RoomPlan map.`);
        setPhase("ready");
        return false;
      }
      await loadPlacementScene(resolvedCameraId);
      setPlacementProposal(localization);
      setManualPlacement(null);
      setConnectionNotice(`ONE found a possible camera position${localization.confidence == null ? "" : ` at ${Math.round(localization.confidence * 100)}% confidence`}. Check the amber preview before saving it.`);
      setPhase("review-placement");
      return true;
    } catch (error) {
      setLocalizationProgress(null);
      if (error instanceof Error && error.message === "API_409") {
        setConnectionNotice(automatic
          ? "A LiDAR map is available, but its visual landmark index is not ready yet. When it is ready, try automatic placement again or place the camera manually."
          : "Camera setup is ready. Add or refresh the iPhone LiDAR RoomPlan scan, then use Position this camera in 3D while the Mac stays in this fixed view.");
        setPhase("ready");
        return false;
      }
      setPhase("failed");
      setMapError(describeCameraLocalizationError(error));
      return false;
    }
  }, [cameraId, loadPlacementScene, stream]);

  const refreshReferenceSnapshot = useCallback(async () => {
    if (!stream || !videoRef.current || savingReference) return;
    setSavingReference(true);
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      const frame = captureCurrentCameraFrame(videoRef.current, 1280, 0.82);
      await api.saveCameraReferenceSnapshot(resolvedCameraId, frame);
      setConnectionNotice("Reference view updated. It can now be shown with this camera on the home map.");
    } catch (error) {
      setMapError(describeCameraError(error));
    } finally {
      setSavingReference(false);
    }
  }, [cameraId, savingReference, stream]);

  const togglePublisher = () => {
    if (onTogglePause) {
      if (!paused) stop();
      onTogglePause();
      return;
    }
    stop();
  };

  const actionLabel = stream
    ? onTogglePause
      ? paused
        ? "Resume publishing"
        : "Pause publishing"
      : "Stop preview"
    : starting
      ? "Opening secure preview…"
      : "Start consented preview";

  return (
    <section className={`panel publisher-card camera-setup-card ${embedded ? "camera-setup-embedded" : ""} ${consented ? "has-consent" : ""}`}>
      <div className="publisher-heading">
        <div className="camera-setup-title-row">
          <span className="camera-setup-icon" aria-hidden="true"><Camera size={19} /></span>
          <span><span className="eyebrow">CAMERA SETUP</span><strong>Finish on this device</strong></span>
        </div>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <div className="camera-stage-summary" aria-hidden="true">
        <span>Step {setupStage + 1} of {setupSteps.length}</span>
        <strong>{setupSteps[setupStage]}</strong>
      </div>

      <div className="camera-setup-progress" aria-label="Camera setup progress">
        {setupSteps.map((label, index) => (
          <span className={stepClass(index, setupStage)} key={label}>
            <span>{index < setupStage ? <Check size={12} /> : index + 1}</span>
            {label}
          </span>
        ))}
      </div>

      {stream ? (
        <div className="video-preview">
          <video ref={videoRef} autoPlay muted playsInline />
          <span className="recording-pill"><span className="record-dot" /> Preview only · {connection ? "LiveKit connected" : demoMode ? "demo" : "preview active"}</span>
          {phase === "sweeping" && (
            <div className="sweep-instruction" role="status">
              <strong>Room walkthrough recording</strong>
              <span>Walk slowly through the room. Turn through corners, include the floor-wall boundary, doors, and large furniture. Normal hand movement is okay.</span>
              <progress value={sweepProgress} max={100} aria-label={`${sweepProgress}% of room walkthrough captured`} />
              <small>{sweepProgress}% captured · keep moving smoothly</small>
            </div>
          )}
        </div>
      ) : (
        <div className="camera-placeholder camera-setup-placeholder"><Camera size={30} /><span>Preview appears after consent</span></div>
      )}

      <label className={`publisher-consent camera-consent ${consented ? "is-consented" : ""}`}>
        <input type="checkbox" checked={consented} onChange={(event) => { const next = event.target.checked; setConsented(next); if (!next && stream) stop(); }} />
        <span>I understand what is shared and consent to camera and microphone capture for this household.</span>
      </label>

      {connectionNotice && <div className="camera-notice" role="status"><LockKeyhole size={15} /> {connectionNotice}</div>}
      {remoteCalibration && (
        <div className="camera-notice" role="status">
          <Map size={15} />
          <span>
            <strong>iPhone-guided calibration</strong>{" "}
            {remoteCalibration.status === "review"
              ? "Ready for review on the iPhone."
                : remoteCalibration.status === "failed" || remoteCalibration.status === "expired"
                  ? (remoteCalibration.error ?? "Needs another attempt.")
                : remoteCalibration.status === "solving"
                  ? `${Math.max(1, Math.min(100, remoteCalibration.solve_progress ?? 1))}% · ${remoteCalibration.solve_stage ?? "Matching the fixed view to RoomPlan"}. Keep the camera still.`
                  : `Reference view ${remoteCalibration.current_target_index + 1} of ${remoteCalibration.capture_round_count} · ${remoteCalibration.status === "capture_requested" ? "capture requested" : "waiting for the caregiver"}.`}
            {remoteCalibration.status === "solving" && (
              <progress
                value={Math.max(1, Math.min(100, remoteCalibration.solve_progress ?? 1))}
                max={100}
                aria-label={`${Math.max(1, Math.min(100, remoteCalibration.solve_progress ?? 1))}% of camera localization complete`}
              />
            )}
          </span>
        </div>
      )}
      {mapError && (
        <div className="error-note" role="alert">
          <span>{mapError}</span>
          {cameraId && (phase === "failed" || phase === "needs-rescan" || phase === "unavailable") && (
            <span className="camera-map-error-actions">
              <button type="button" className="text-button" onClick={retrySweep}><RotateCcw size={14} /> Try walkthrough again</button>
              <button type="button" className="text-button" onClick={continueWithoutMap}><Check size={14} /> Continue without map</button>
            </span>
          )}
        </div>
      )}

      {phase === "preview" ? (
        <div className="room-sweep-status" role="status">
          <Video size={17} /><span><strong>Preview is ready.</strong><small>Keep this device fixed. Calibration, manual positioning, and room walkthroughs run only when you choose them below.</small></span>
        </div>
      ) : phase === "processing" || phase === "submitting" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>{phase === "submitting" ? "Sending the walkthrough securely…" : "Building the room draft…"}</strong><small>{generationQuery.data?.progress ?? 0}% complete · temporary walkthrough frames are only used for this generation.</small></span>
        </div>
      ) : phase === "place-camera" ? (
        <div className="room-sweep-status place-camera" role="status">
          <CheckCircle2 size={17} /><span><strong>Room draft is ready.</strong><small>The camera keeps publishing normally. Open Position &amp; map only when you want to calibrate, adjust the position, or refresh the room map.</small></span>
        </div>
      ) : phase === "localizing" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>{Math.max(1, Math.min(100, localizationProgress?.progress ?? 1))}% · {localizationProgress?.stage ?? "Matching the fixed view to RoomPlan"}</strong><small>Keep the camera still while local feature matching and PnP estimate its 3D pose.</small><progress value={Math.max(1, Math.min(100, localizationProgress?.progress ?? 1))} max={100} aria-label={`${Math.max(1, Math.min(100, localizationProgress?.progress ?? 1))}% of camera localization complete`} /></span>
        </div>
      ) : phase === "review-placement" ? (
        <div className="room-sweep-status place-camera" role="status">
          <Map size={17} /><span><strong>Automatic position ready to review.</strong><small>The amber camera below is a proposal. It is not active until you confirm it.</small></span>
        </div>
      ) : phase === "manual-placement" ? (
        <div className="room-sweep-status place-camera" role="status">
          <Map size={17} /><span><strong>Manual placement mode.</strong><small>Click the correct camera location on the map and tune the direction before saving.</small></span>
        </div>
      ) : phase === "saving-placement" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>Saving the reviewed position…</strong><small>This replaces the previous active camera placement only after the save succeeds.</small></span>
        </div>
      ) : phase === "ready" ? (
        <div className="room-sweep-status ready" role="status">
          <CheckCircle2 size={17} /><span><strong>Camera saved and ready.</strong><small>Keep this camera fixed. After the iPhone LiDAR scan is saved, use Position this camera in 3D to localize this exact live view in the RoomPlan coordinate frame.</small></span>
        </div>
      ) : null}

      {placementScene && previewRegistration && ["review-placement", "manual-placement", "saving-placement"].includes(phase) && (
        <div className="camera-placement-review">
          <div className="camera-placement-review-heading">
            <span><span className="eyebrow">ROOMPLAN PREVIEW</span><strong>{manualPlacement ? "Manual camera position" : "Automatic camera proposal"}</strong></span>
            <small>Amber = position that will be saved</small>
          </div>
          <Suspense fallback={<div className="camera-placement-map-loading">Loading RoomPlan preview…</div>}>
            <RoomPlanFloorPlan2D
              scene={placementScene}
              objects={[]}
              loadUSDZ={loadPlacementUSDZ}
              previewRegistration={previewRegistration}
              placement={manualPlacement ? {
                enabled: phase === "manual-placement",
                onPoint: (point) => setManualPlacement((current) => current ? {
                  ...current,
                  x: point.x,
                  z: point.z,
                  floorY: floorYForPoint(placementScene, point),
                } : current),
              } : undefined}
            />
          </Suspense>
          {manualPlacement ? (
            <div className="camera-manual-controls">
              <div className="camera-manual-position">
                <span><small>X</small><strong>{manualPlacement.x.toFixed(2)} m</strong></span>
                <span><small>Z</small><strong>{manualPlacement.z.toFixed(2)} m</strong></span>
              </div>
              <label>
                Viewing direction <strong>{Math.round(manualPlacement.yawDeg)}°</strong>
                <input type="range" min="-180" max="180" step="1" value={manualPlacement.yawDeg} onChange={(event) => setManualPlacement((current) => current ? { ...current, yawDeg: Number(event.target.value) } : current)} />
              </label>
              <label>
                Downward tilt <strong>{Math.round(manualPlacement.tiltDeg)}°</strong>
                <input type="range" min="-45" max="45" step="1" value={manualPlacement.tiltDeg} onChange={(event) => setManualPlacement((current) => current ? { ...current, tiltDeg: Number(event.target.value) } : current)} />
              </label>
              <label className="camera-height-control">
                Camera height above floor
                <input type="number" min="0.2" max="3.5" step="0.05" value={manualPlacement.heightM.toFixed(2)} onChange={(event) => setManualPlacement((current) => current ? { ...current, heightM: Math.max(0.2, Math.min(3.5, Number(event.target.value) || 0.2)) } : current)} />
                <span>m</span>
              </label>
              <div className="camera-placement-actions">
                <button className="primary-button" disabled={phase === "saving-placement"} onClick={() => void saveReviewedPlacement(matrixFromManualPlacement(manualPlacement), null)}><Check size={16} /> Save manual position</button>
                <button className="secondary-button" disabled={phase === "saving-placement"} onClick={() => {
                  setManualPlacement(null);
                  setPhase(placementProposal?.camera_to_world ? "review-placement" : "ready");
                }}>{placementProposal?.camera_to_world ? "Back to automatic proposal" : "Cancel"}</button>
              </div>
            </div>
          ) : (
            <div className="camera-placement-actions">
              <button className="primary-button" disabled={phase === "saving-placement" || !placementProposal?.camera_to_world} onClick={() => placementProposal?.camera_to_world && void saveReviewedPlacement(placementProposal.camera_to_world, placementProposal.confidence)}><Check size={16} /> Yes, this position is correct</button>
              <button className="secondary-button" disabled={phase === "saving-placement"} onClick={() => void beginManualPlacement()}><Map size={16} /> Adjust manually</button>
              <button className="secondary-button" disabled={phase === "saving-placement"} onClick={() => {
                setPlacementProposal(null);
                setManualPlacement(null);
                void confirmPlacement(false);
              }}><RotateCcw size={16} /> Run calibration again</button>
            </div>
          )}
        </div>
      )}

      <div className="publisher-actions">
        {!stream ? (
          <button className="primary-button" onClick={start} disabled={starting || !consented}>
            <Video size={16} /> {actionLabel}
          </button>
        ) : (
          <>
            {phase === "preview" && (
              <button className="primary-button" onClick={continueWithoutMap}>
                <Check size={16} /> Use camera without map
              </button>
            )}
            <button className="secondary-button" onClick={togglePublisher}>
              {onTogglePause ? (paused ? <Play size={16} /> : <Pause size={16} />) : <Pause size={16} />} {actionLabel}
            </button>
            <details className="camera-spatial-menu">
              <summary><Map size={16} /> Position & map</summary>
              <div className="camera-spatial-menu-actions">
                <p>Optional spatial tools. Nothing runs until you choose an action.</p>
                {["preview", "ready", "needs-rescan", "unavailable", "failed", "place-camera"].includes(phase) && (
                  <button className="primary-button" onClick={() => void confirmPlacement(false)}>
                    <Map size={16} /> {phase === "ready" ? "Run calibration again" : "Calibrate camera"}
                  </button>
                )}
                {["preview", "ready", "needs-rescan", "unavailable", "failed", "place-camera"].includes(phase) && (
                  <button className="secondary-button" onClick={() => void beginManualPlacement()}>
                    <Map size={16} /> Set position manually
                  </button>
                )}
                {phase === "ready" && (
                  <button className="secondary-button" disabled={savingReference} onClick={() => void refreshReferenceSnapshot()}>
                    <Camera size={16} /> {savingReference ? "Saving reference…" : "Refresh map reference view"}
                  </button>
                )}
                {["preview", "needs-rescan", "unavailable", "failed", "ready", "place-camera"].includes(phase) && (
                  <button className="secondary-button" onClick={() => void recordWalkthrough()}>
                    <Video size={16} /> {phase === "ready" ? "Refresh room walkthrough" : "Record optional room walkthrough"}
                  </button>
                )}
              </div>
            </details>
          </>
        )}
        <span className="muted secure-note"><LockKeyhole size={14} /> Encrypted in transit · local network</span>
      </div>
    </section>
  );
}

export function stopCameraSetup(): void {
  stopActivePublisher();
  clearPublisherRegistry();
}
