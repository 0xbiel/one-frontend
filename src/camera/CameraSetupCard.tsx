import { useEffect, useRef, useState } from "react";
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
import type { PublisherConnection } from "../livekit/publisher";
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

type CameraSetupCardProps = {
  embedded?: boolean;
  paused?: boolean;
  onTogglePause?: () => void;
};

type SweepPhase = "idle" | "preview" | "sweeping" | "submitting" | "processing" | "place-camera" | "localizing" | "ready" | "needs-rescan" | "unavailable" | "failed";

const setupSteps = ["Consent", "Preview", "Walkthrough", "Place camera", "Ready"];

function stageFor(consented: boolean, phase: SweepPhase): number {
  if (!consented) return 0;
  if (phase === "idle" || phase === "preview") return 1;
  if (["sweeping", "submitting", "processing", "needs-rescan", "unavailable", "failed"].includes(phase)) return 2;
  if (phase === "place-camera" || phase === "localizing") return 3;
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
      return { title: "Preview first. Map when you are ready.", description: "The camera is already paired and saved. Check the view now, then record a short room walkthrough when it is convenient." };
    case "sweeping":
      return { title: "Walk ONE around the room.", description: "Move naturally around the room and turn slowly through the corners. Include the floor-wall boundary and large furniture; you do not need to hold the phone perfectly still." };
    case "submitting":
    case "processing":
      return { title: "Building a room draft.", description: "The local room-layout service is turning the walkthrough into approximate camera geometry. The camera stays paired even if this draft needs another pass." };
    case "place-camera":
      return { title: "One last placement check.", description: "Put the device in its fixed spot. If this home has an iPhone RoomPlan scan, ONE will locate this camera inside that 3D map automatically." };
    case "localizing":
      return { title: "Finding this camera in 3D.", description: "Keep the camera still while ONE matches this view against the private RoomPlan visual landmark index." };
    case "ready":
      return { title: "Camera setup is ready.", description: "Object vision can run locally now. A room map improves spatial context, and a LiDAR RoomPlan scan can later upgrade positioning to metric 3D." };
    default:
      return { title: "A clear view, with consent.", description: "Give ONE permission only after you know what this device will share. Pairing is already saved separately from room mapping." };
  }
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sweepControllerRef = useRef<AbortController | null>(null);
  const generationQuery = useMapGeneration(cameraId ?? undefined, jobId ?? undefined);
  const setupStage = stageFor(consented, phase);
  const copy = phaseCopy(phase);

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
    if (["idle", "preview", "sweeping", "submitting", "needs-rescan", "unavailable", "failed"].includes(phase)) {
      setPhase("idle");
      setSweepProgress(0);
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

  const confirmPlacement = async () => {
    if (!stream || !videoRef.current) return;
    setPhase("localizing");
    setMapError("");
    try {
      const resolvedCameraId = cameraId ?? await cameraIdFromSession();
      if (!resolvedCameraId) throw new Error("CAMERA_NOT_REGISTERED");
      setCameraId(resolvedCameraId);
      const frames = await captureFixedCameraFrames(videoRef.current, stream, { frameCount: 6, durationMs: demoMode ? 120 : 1_600 });
      const localization = await api.localizeRoomPlanCamera(resolvedCameraId, frames);
      if (localization.status !== "positioned") {
        setConnectionNotice("The camera is ready with the 2D room draft. Automatic 3D placement could not be confirmed, so you can add or refresh a LiDAR RoomPlan scan later.");
        setPhase("ready");
        return;
      }
      setConnectionNotice(`Positioned in the RoomPlan 3D map · ${localization.inlier_count} inliers${localization.confidence == null ? "" : ` · ${Math.round(localization.confidence * 100)}% confidence`}.`);
      setPhase("ready");
    } catch (error) {
      if (error instanceof Error && error.message === "API_409") {
        setConnectionNotice("Camera setup is ready in 2D. Add or refresh the iPhone RoomPlan scan to enable automatic 3D positioning.");
        setPhase("ready");
        return;
      }
      setPhase("failed");
      setMapError(describeCameraError(error));
    }
  };

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
          <Video size={17} /><span><strong>Preview is ready.</strong><small>Check the rear-camera view. Record the walkthrough when convenient, or keep the paired camera saved and finish mapping later.</small></span>
        </div>
      ) : phase === "processing" || phase === "submitting" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>{phase === "submitting" ? "Sending the walkthrough securely…" : "Building the room draft…"}</strong><small>{generationQuery.data?.progress ?? 0}% complete · temporary walkthrough frames are only used for this generation.</small></span>
        </div>
      ) : phase === "place-camera" ? (
        <div className="room-sweep-status place-camera" role="status">
          <CheckCircle2 size={17} /><span><strong>Relative 2D geometry is ready.</strong><small>Place the camera in its fixed position to finish setup.</small></span>
          <button type="button" className="secondary-button" disabled={!stream} onClick={() => void confirmPlacement()}>{stream ? "Camera is in its fixed spot" : "Start preview to confirm placement"} <Check size={14} /></button>
        </div>
      ) : phase === "localizing" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>Matching the fixed view to RoomPlan…</strong><small>Keep the camera still while local feature matching and PnP estimate its 3D pose.</small></span>
        </div>
      ) : phase === "ready" ? (
        <div className="room-sweep-status ready" role="status">
          <CheckCircle2 size={17} /><span><strong>Camera saved and ready.</strong><small>A visual room draft is optional. When LiDAR RoomPlan is available, ONE can use its metric 3D frame for higher-quality positioning.</small></span>
        </div>
      ) : null}

      <div className="publisher-actions">
        {!stream ? (
          <button className="primary-button" onClick={start} disabled={starting || !consented}>
            <Video size={16} /> {actionLabel}
          </button>
        ) : (
          <>
            {["preview", "needs-rescan", "unavailable", "failed", "ready"].includes(phase) && (
              <button className="primary-button" onClick={() => void recordWalkthrough()}>
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
