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
import type { CameraLocalizationPersonAnchor, CameraLocalizationResponse, MapGenerationFrame } from "../api/client";
import type { PublisherConnection } from "../livekit/publisher";
import type { CameraRegistration, Scene } from "../models/domain";
import {
  clearPublisherRegistry,
  registerPublisherConnection,
  registerPublisherStream,
  stopActivePublisher,
} from "../livekit/registry";
import { describeCameraError, describeLiveKitError } from "./errors";
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

type SweepPhase = "idle" | "preview" | "sweeping" | "submitting" | "processing" | "place-camera" | "guided-calibration" | "localizing" | "review-placement" | "manual-placement" | "saving-placement" | "ready" | "needs-rescan" | "unavailable" | "failed";

type ManualPlacement = {
  x: number;
  z: number;
  floorY: number;
  heightM: number;
  yawDeg: number;
  tiltDeg: number;
};

type GuidedCalibrationTarget = {
  x: number;
  z: number;
  floorY: number;
};

const setupSteps = ["Consent", "Preview", "Walkthrough", "Review placement", "Ready"];

function stageFor(consented: boolean, phase: SweepPhase): number {
  if (!consented) return 0;
  if (phase === "idle" || phase === "preview") return 1;
  if (["sweeping", "submitting", "processing", "needs-rescan", "unavailable", "failed"].includes(phase)) return 2;
  if (["place-camera", "guided-calibration", "localizing", "review-placement", "manual-placement", "saving-placement"].includes(phase)) return 3;
  if (phase === "ready") return 4;
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
      return { title: "One last placement check.", description: "Put the device in its fixed spot. If this home has an iPhone RoomPlan scan, ONE will locate this camera inside that 3D map automatically." };
    case "guided-calibration":
      return { title: "Stand on four points to calibrate the fixed camera.", description: "ONE shows four spread-out floor targets from the RoomPlan map. Stand on each target and capture it; your position becomes a temporary geometric marker and the frames are not stored." };
    case "localizing":
      return { title: "Finding this camera in 3D.", description: "Keep the camera still while ONE matches this view against the private RoomPlan visual landmark index." };
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

function polygonArea(polygon: Array<{ x: number; z: number }>): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    area += current.x * next.z - next.x * current.z;
  }
  return Math.abs(area) * 0.5;
}

function guidedCalibrationTargets(scene: Scene): GuidedCalibrationTarget[] {
  const zones = [...(scene.geometry?.roomZones ?? [])].sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon));
  const zone = zones[0];
  if (!zone || zone.polygon.length < 3) return [];
  const xs = zone.polygon.map((point) => point.x);
  const zs = zone.polygon.map((point) => point.z);
  const center = {
    x: zone.polygon.reduce((sum, point) => sum + point.x, 0) / zone.polygon.length,
    z: zone.polygon.reduce((sum, point) => sum + point.z, 0) / zone.polygon.length,
  };
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  const raw = [
    { x: bounds.minX * 0.72 + bounds.maxX * 0.28, z: bounds.minZ * 0.72 + bounds.maxZ * 0.28 },
    { x: bounds.minX * 0.28 + bounds.maxX * 0.72, z: bounds.minZ * 0.72 + bounds.maxZ * 0.28 },
    { x: bounds.minX * 0.72 + bounds.maxX * 0.28, z: bounds.minZ * 0.28 + bounds.maxZ * 0.72 },
    { x: bounds.minX * 0.28 + bounds.maxX * 0.72, z: bounds.minZ * 0.28 + bounds.maxZ * 0.72 },
  ];
  return raw.map((candidate) => {
    if (pointInPolygon(candidate, zone.polygon)) return { ...candidate, floorY: zone.floorY };
    for (const factor of [0.8, 0.6, 0.4, 0.2]) {
      const point = { x: center.x + (candidate.x - center.x) * factor, z: center.z + (candidate.z - center.z) * factor };
      if (pointInPolygon(point, zone.polygon)) return { ...point, floorY: zone.floorY };
    }
    return { ...center, floorY: zone.floorY };
  });
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
  const [guidedTargets, setGuidedTargets] = useState<GuidedCalibrationTarget[]>([]);
  const [guidedTargetIndex, setGuidedTargetIndex] = useState(0);
  const [guidedFrames, setGuidedFrames] = useState<MapGenerationFrame[]>([]);
  const [guidedAnchors, setGuidedAnchors] = useState<CameraLocalizationPersonAnchor[]>([]);
  const [guidedCapturing, setGuidedCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sweepControllerRef = useRef<AbortController | null>(null);
  const autoLocalizationRef = useRef<{ mapId: string; attempts: number; lastAttemptAt: number } | null>(null);
  const autoLocalizationRunningRef = useRef(false);
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
  const activeGuidedTarget = guidedTargets[guidedTargetIndex] ?? null;
  const guidedTargetMarkers = guidedTargets.map((target, index) => ({
    x: target.x,
    y: target.floorY,
    z: target.z,
    state: index < guidedTargetIndex ? "complete" as const : index === guidedTargetIndex ? "active" as const : "pending" as const,
  }));

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
        const latest = await api.getLatestMapGeneration(resolvedCameraId);
        if (cancelled || !latest) return;
        setJobId(latest.job_id);
        if (latest.status === "ready") setPhase("place-camera");
        else if (latest.status === "processing" || latest.status === "collecting") setPhase(latest.status === "processing" ? "processing" : "idle");
        else if (latest.status === "needs_rescan") {
          setPhase("needs-rescan");
          setMapError("The last walkthrough did not produce a confident map. The camera is still saved; retry only if you want better room context.");
        } else if (latest.status === "unavailable") {
          setPhase("unavailable");
          setMapError("Mapping was unavailable last time. The paired camera can still be used without a room map.");
        } else if (latest.status === "failed") {
          setPhase("failed");
          setMapError("The last room draft could not be built. The paired camera was not lost.");
        }
      } catch {
        // Pairing/session recovery is best-effort.  The normal preview action
        // still resolves the camera id before a walkthrough is submitted.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    if (["idle", "preview", "sweeping", "submitting", "guided-calibration", "review-placement", "manual-placement", "saving-placement", "needs-rescan", "unavailable", "failed"].includes(phase)) {
      setPhase("idle");
      setSweepProgress(0);
      setPlacementProposal(null);
      setManualPlacement(null);
      setGuidedTargets([]);
      setGuidedTargetIndex(0);
      setGuidedFrames([]);
      setGuidedAnchors([]);
      setGuidedCapturing(false);
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

  const loadPlacementUSDZ = useCallback(async (_mapId: string): Promise<ArrayBuffer> => {
    const targetCameraId = cameraId ?? await cameraIdFromSession();
    if (!targetCameraId) throw new Error("CAMERA_NOT_REGISTERED");
    return api.getRoomPlanPlacementPreviewUSDZ(targetCameraId);
  }, [cameraId]);

  const beginGuidedCalibration = useCallback(async () => {
    if (!stream) return;
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const scene = placementScene ?? await loadPlacementScene(resolvedCameraId);
      const targets = guidedCalibrationTargets(scene);
      if (targets.length < 4) throw new Error("ROOMPLAN_MAP_REQUIRED");
      setGuidedTargets(targets);
      setGuidedTargetIndex(0);
      setGuidedFrames([]);
      setGuidedAnchors([]);
      setPlacementProposal(null);
      setManualPlacement(null);
      setPhase("guided-calibration");
      setConnectionNotice("Guided calibration is ready. Stand on point 1, then capture it. If a target is blocked, click a nearby clear floor spot on the map first.");
    } catch (error) {
      setMapError(error instanceof Error && error.message === "ROOMPLAN_MAP_REQUIRED"
        ? "A native RoomPlan 3D map with a floor zone is required for guided calibration."
        : describeCameraError(error));
    }
  }, [cameraId, loadPlacementScene, placementScene, stream]);

  const captureGuidedCalibrationTarget = useCallback(async () => {
    if (!stream || !videoRef.current || guidedCapturing || guidedTargetIndex >= guidedTargets.length) return;
    const target = guidedTargets[guidedTargetIndex];
    setGuidedCapturing(true);
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const burst = await captureFixedCameraFrames(videoRef.current, stream, { frameCount: 2, durationMs: demoMode ? 80 : 650 });
      const baseIndex = guidedFrames.length;
      const nextFrames = [...guidedFrames, ...burst];
      const nextAnchors = [
        ...guidedAnchors,
        ...burst.map((_, offset) => ({
          frame_index: baseIndex + offset,
          x: target.x,
          y: target.floorY,
          z: target.z,
        })),
      ];
      setGuidedFrames(nextFrames);
      setGuidedAnchors(nextAnchors);

      if (guidedTargetIndex < guidedTargets.length - 1) {
        const nextIndex = guidedTargetIndex + 1;
        setGuidedTargetIndex(nextIndex);
        setConnectionNotice(`Point ${guidedTargetIndex + 1} captured. Move to point ${nextIndex + 1}; other people can stay in the room.`);
        return;
      }

      setPhase("localizing");
      setConnectionNotice("All four floor points are captured. ONE is solving the fixed camera pose from the person markers now.");
      const localization = await api.localizeRoomPlanCamera(resolvedCameraId, nextFrames, 60, true, nextAnchors);
      setGuidedTargets([]);
      setGuidedTargetIndex(0);
      setGuidedFrames([]);
      setGuidedAnchors([]);
      if (localization.status !== "positioned" || !localization.camera_to_world) {
        setConnectionNotice("Guided calibration could not produce a confident placement. You can run the four points again, try normal automatic placement, or set the camera manually.");
        setPhase("ready");
        return;
      }
      setPlacementProposal(localization);
      setManualPlacement(null);
      setConnectionNotice(`Guided calibration found a camera position${localization.confidence == null ? "" : ` at ${Math.round(localization.confidence * 100)}% confidence`}. Check the amber preview before saving it.`);
      setPhase("review-placement");
    } catch (error) {
      setGuidedTargetIndex(0);
      setGuidedFrames([]);
      setGuidedAnchors([]);
      setPhase("guided-calibration");
      setMapError(describeCameraError(error));
      setConnectionNotice("The guided capture was reset. Start again from point 1 when you are ready.");
    } finally {
      setGuidedCapturing(false);
    }
  }, [cameraId, guidedAnchors, guidedCapturing, guidedFrames, guidedTargetIndex, guidedTargets, stream]);

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
      setPlacementProposal(null);
      setManualPlacement(null);
      setConnectionNotice("Camera position confirmed and saved in the RoomPlan map.");
      setPhase("ready");
    } catch (error) {
      setPhase(manualPlacement ? "manual-placement" : "review-placement");
      setMapError(error instanceof Error && error.message === "CAMERA_POSITION_NOT_ACCEPTED"
        ? "That camera position could not be saved. Adjust it and try again."
        : describeCameraError(error));
    }
  }, [cameraId, manualPlacement, placementScene]);

  const confirmPlacement = useCallback(async (automatic = false): Promise<boolean> => {
    if (!stream || !videoRef.current) return false;
    setPhase("localizing");
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const frames = await captureFixedCameraFrames(videoRef.current, stream, { frameCount: 6, durationMs: demoMode ? 120 : 1_600 });
      const localization = await api.localizeRoomPlanCamera(resolvedCameraId, frames, 60, true);
      if (localization.status !== "positioned" || !localization.camera_to_world) {
        setPlacementProposal(null);
        setConnectionNotice("Automatic 3D placement was not confident enough to propose a position. You can retry once when you want, or place the camera manually on the RoomPlan map.");
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
      if (error instanceof Error && error.message === "API_409") {
        setConnectionNotice(automatic
          ? "A LiDAR map is available, but its visual landmark index is not ready yet. When it is ready, try automatic placement again or place the camera manually."
          : "Camera setup is ready. Add or refresh the iPhone LiDAR RoomPlan scan, then use Position this camera in 3D while the Mac stays in this fixed view.");
        setPhase("ready");
        return false;
      }
      setPhase("failed");
      setMapError(describeCameraError(error));
      return false;
    }
  }, [cameraId, loadPlacementScene, stream]);

  useEffect(() => {
    if (!stream || !cameraId || paused || demoMode || ["guided-calibration", "localizing", "review-placement", "manual-placement", "saving-placement"].includes(phase)) return;
    let cancelled = false;
    const checkForLiDARMap = async () => {
      if (cancelled || autoLocalizationRunningRef.current) return;
      try {
        const readiness = await api.getRoomPlanReadiness(cameraId);
        if (!readiness.ready || !readiness.map_id) return;
        const now = Date.now();
        const previous = autoLocalizationRef.current;
        const state = previous?.mapId === readiness.map_id ? previous : { mapId: readiness.map_id, attempts: 0, lastAttemptAt: 0 };
        if (state.attempts >= 1 || now - state.lastAttemptAt < 3_500) return;
        autoLocalizationRef.current = { mapId: readiness.map_id, attempts: state.attempts + 1, lastAttemptAt: now };
        autoLocalizationRunningRef.current = true;
        const positioned = await confirmPlacement(true);
        if (positioned) autoLocalizationRef.current = { mapId: readiness.map_id, attempts: 1, lastAttemptAt: Date.now() };
      } catch (error) {
        if (!(error instanceof Error && error.message === "API_401")) {
          setMapError(describeCameraError(error));
        }
      } finally {
        autoLocalizationRunningRef.current = false;
      }
    };
    void checkForLiDARMap();
    const interval = window.setInterval(() => { void checkForLiDARMap(); }, 4_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [cameraId, confirmPlacement, paused, phase, stream]);

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

      <div className="camera-setup-progress camera-setup-progress-five" aria-label="Camera setup progress">
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
          {phase === "guided-calibration" && activeGuidedTarget && (
            <div className="sweep-instruction guided-calibration-instruction" role="status">
              <strong>Calibration point {guidedTargetIndex + 1} of {guidedTargets.length}</strong>
              <span>Stand on the highlighted floor point shown below. Other people may stay in view; hold your position briefly when you capture.</span>
              <small>{guidedCapturing ? "Capturing two short frames…" : "The fixed camera must stay completely still."}</small>
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
          <Video size={17} /><span><strong>Preview is ready.</strong><small>Keep this Mac in its fixed camera position. You can scan the room separately with the iPhone LiDAR app, then match this live view into that 3D map. The 2D walkthrough is optional.</small></span>
        </div>
      ) : phase === "processing" || phase === "submitting" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>{phase === "submitting" ? "Sending the walkthrough securely…" : "Building the room draft…"}</strong><small>{generationQuery.data?.progress ?? 0}% complete · temporary walkthrough frames are only used for this generation.</small></span>
        </div>
      ) : phase === "place-camera" ? (
        <div className="room-sweep-status place-camera" role="status">
          <CheckCircle2 size={17} /><span><strong>Relative 2D geometry is ready.</strong><small>Place the camera in its fixed position to finish setup.</small></span>
          <button type="button" className="secondary-button" disabled={!stream} onClick={() => void confirmPlacement(false)}>{stream ? "Find its position automatically" : "Start preview to position camera"} <Check size={14} /></button>
          <button type="button" className="secondary-button" disabled={!stream} onClick={() => void beginGuidedCalibration()}>{stream ? "Calibrate with 4 standing points" : "Start preview to calibrate"} <Map size={14} /></button>
        </div>
      ) : phase === "guided-calibration" ? (
        <div className="room-sweep-status place-camera guided-calibration-status" role="status">
          <Map size={17} /><span><strong>Point {guidedTargetIndex + 1} of {guidedTargets.length}.</strong><small>Stand on the active amber target. If that floor spot is blocked, click a nearby clear spot on the map before capturing.</small></span>
        </div>
      ) : phase === "localizing" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>Matching the fixed view to RoomPlan…</strong><small>Keep the camera still while local feature matching and PnP estimate its 3D pose.</small></span>
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

      {placementScene && phase === "guided-calibration" && activeGuidedTarget && (
        <div className="camera-placement-review guided-calibration-review">
          <div className="camera-placement-review-heading">
            <span><span className="eyebrow">GUIDED CALIBRATION</span><strong>Stand on point {guidedTargetIndex + 1} of {guidedTargets.length}</strong></span>
            <small>Amber = current target · cyan = captured</small>
          </div>
          <Suspense fallback={<div className="camera-placement-map-loading">Loading RoomPlan floor targets…</div>}>
            <RoomPlanFloorPlan2D
              scene={placementScene}
              objects={[]}
              loadUSDZ={loadPlacementUSDZ}
              calibrationTargets={guidedTargetMarkers}
              placement={{
                enabled: !guidedCapturing,
                hint: "Target blocked? Click a nearby clear floor spot",
                onPoint: (point) => setGuidedTargets((current) => current.map((target, index) => index === guidedTargetIndex ? {
                  ...target,
                  x: point.x,
                  z: point.z,
                  floorY: floorYForPoint(placementScene, point),
                } : target)),
              }}
            />
          </Suspense>
          <div className="guided-calibration-controls">
            <div className="guided-calibration-target-meta">
              <span><small>X</small><strong>{activeGuidedTarget.x.toFixed(2)} m</strong></span>
              <span><small>Z</small><strong>{activeGuidedTarget.z.toFixed(2)} m</strong></span>
              <span><small>CAPTURED</small><strong>{guidedTargetIndex} / {guidedTargets.length}</strong></span>
            </div>
            <p className="muted small-copy">Stand with both feet around the highlighted point. Exact centimetres are not required; staying roughly on the marker for the short capture is enough.</p>
            <div className="camera-placement-actions">
              <button className="primary-button" disabled={guidedCapturing} onClick={() => void captureGuidedCalibrationTarget()}><Check size={16} /> {guidedCapturing ? "Capturing…" : `I'm on point ${guidedTargetIndex + 1} · capture`}</button>
              <button className="secondary-button" disabled={guidedCapturing} onClick={() => {
                setGuidedTargets([]);
                setGuidedTargetIndex(0);
                setGuidedFrames([]);
                setGuidedAnchors([]);
                setConnectionNotice("Guided calibration cancelled. The camera position was not changed.");
                setPhase("ready");
              }}>Cancel calibration</button>
            </div>
          </div>
        </div>
      )}

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
                setPhase("ready");
              }}><RotateCcw size={16} /> Try automatic again</button>
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
            {["preview", "ready", "needs-rescan", "unavailable", "failed"].includes(phase) && (
              <button className="primary-button" onClick={() => void confirmPlacement(false)}>
                <Map size={16} /> Try automatic placement
              </button>
            )}
            {["preview", "ready", "needs-rescan", "unavailable", "failed"].includes(phase) && (
              <button className="secondary-button" onClick={() => void beginGuidedCalibration()}>
                <Map size={16} /> Calibrate with 4 standing points
              </button>
            )}
            {["preview", "ready", "needs-rescan", "unavailable", "failed"].includes(phase) && (
              <button className="secondary-button" onClick={() => void beginManualPlacement()}>
                <Map size={16} /> Set position manually
              </button>
            )}
            {["preview", "needs-rescan", "unavailable", "failed", "ready"].includes(phase) && (
              <button className="secondary-button" onClick={() => void recordWalkthrough()}>
                <Video size={16} /> {phase === "ready" ? "Refresh room walkthrough" : "Record room walkthrough"}
              </button>
            )}
            {phase === "preview" && (
              <button className="secondary-button" onClick={continueWithoutMap}>
                <Check size={16} /> Use camera without map
              </button>
            )}
            <button className="secondary-button" onClick={togglePublisher}>
              {onTogglePause ? (paused ? <Play size={16} /> : <Pause size={16} />) : <Pause size={16} />} {actionLabel}
            </button>
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
