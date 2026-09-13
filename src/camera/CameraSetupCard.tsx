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

type SweepPhase = "idle" | "sweeping" | "submitting" | "processing" | "place-camera" | "ready" | "needs-rescan" | "unavailable" | "failed";

const setupSteps = ["Consent", "Guided sweep", "Processing", "Place camera", "Map ready"];

function stageFor(consented: boolean, phase: SweepPhase): number {
  if (!consented) return 0;
  if (phase === "processing" || phase === "submitting") return 2;
  if (phase === "place-camera") return 3;
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
    case "sweeping":
      return { title: "Show ONE the room.", description: "Move slowly from left to right for a few seconds. ONE uses this approved preview to build a relative 2D map." };
    case "submitting":
    case "processing":
      return { title: "Building your 2D map.", description: "The local room-layout service is turning the sweep into approximate camera geometry. Keep this page open." };
    case "place-camera":
      return { title: "One last placement check.", description: "Put the device in its fixed spot. The map is ready to use once the camera is placed." };
    case "ready":
      return { title: "Your 2D map is ready.", description: "This camera-derived view is relative and approximate. ONE will never present it as measured room scale." };
    default:
      return { title: "A clear view, with consent.", description: "Give ONE permission only after you know what this device will share." };
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
  const [sweepRun, setSweepRun] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sweepControllerRef = useRef<AbortController | null>(null);
  const sweepStartedRef = useRef(false);
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
      setMapError(result.error ?? "The sweep did not contain enough reliable room geometry. Try a slower sweep.");
    } else if (result.status === "unavailable") {
      setPhase("unavailable");
      setMapError(result.error ?? "The local room-layout service is unavailable right now.");
    } else if (result.status === "failed") {
      setPhase("failed");
      setMapError(result.error ?? "The room sweep could not be turned into a map.");
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
    if (!stream || sweepStartedRef.current) return;
    sweepStartedRef.current = true;
    const controller = new AbortController();
    sweepControllerRef.current = controller;
    void (async () => {
      try {
        setPhase("sweeping");
        setSweepProgress(0);
        const capture = await captureRoomSweep(videoRef.current!, stream, {
          frameCount: ROOM_SWEEP_FRAME_COUNT,
          durationMs: demoMode ? 240 : ROOM_SWEEP_DURATION_MS,
          signal: controller.signal,
          onProgress: (captured, total) => setSweepProgress(Math.round((captured / total) * 100)),
        });
        if (controller.signal.aborted) return;
        setPhase("submitting");
        const resolvedCameraId = await cameraIdFromSession();
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
        await api.submitMapGenerationFrames(resolvedCameraId, generation.job_id, capture.frames.map(({ frame_base64, width, height, captured_at }) => ({ frame_base64, width, height, captured_at })));
        if (controller.signal.aborted) return;
        setPhase(generation.status === "ready" ? "place-camera" : "processing");
      } catch (error) {
        if (controller.signal.aborted) return;
        setPhase("failed");
        setMapError(describeCameraError(error));
      }
    })();
    return () => {
      controller.abort();
      if (sweepControllerRef.current === controller) sweepControllerRef.current = null;
      sweepStartedRef.current = false;
    };
  }, [stream, sweepRun]);

  const stop = () => {
    sweepControllerRef.current?.abort();
    sweepControllerRef.current = null;
    stopActivePublisher();
    setStream(null);
    setConnection(null);
    if (phase !== "ready" && phase !== "place-camera") {
      setPhase("idle");
      setSweepProgress(0);
      setCameraId(null);
      setJobId(null);
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

  const retrySweep = () => {
    setMapError("");
    setCameraId(null);
    setJobId(null);
    setSweepProgress(0);
    setPhase("idle");
    setSweepRun((value) => value + 1);
  };

  const confirmPlacement = () => setPhase("ready");

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
    <section className={`panel publisher-card camera-setup-card ${embedded ? "camera-setup-embedded" : ""}`}>
      <div className="publisher-heading">
        <div className="camera-setup-title-row">
          <span className="camera-setup-icon" aria-hidden="true"><Camera size={19} /></span>
          <span><span className="eyebrow">CAMERA SETUP</span><strong>Finish on this device</strong></span>
        </div>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
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
              <strong>Slow room sweep</strong>
              <span>Move the phone gently from left to right.</span>
              <progress value={sweepProgress} max={100} aria-label={`${sweepProgress}% of room sweep captured`} />
              <small>{sweepProgress}% captured · keep the preview open</small>
            </div>
          )}
        </div>
      ) : (
        <div className="camera-placeholder camera-setup-placeholder"><Camera size={30} /><span>Preview appears after consent</span></div>
      )}

      <label className="publisher-consent camera-consent">
        <input type="checkbox" checked={consented} onChange={(event) => { const next = event.target.checked; setConsented(next); if (!next && stream) stop(); }} />
        <span>I understand what is shared and consent to camera and microphone capture for this household.</span>
      </label>

      {connectionNotice && <div className="camera-notice" role="status"><LockKeyhole size={15} /> {connectionNotice}</div>}
      {mapError && (
        <div className="error-note" role="alert">
          <span>{mapError}</span>
          {(phase === "failed" || phase === "needs-rescan" || phase === "unavailable") && <button type="button" className="text-button" onClick={retrySweep}><RotateCcw size={14} /> Retry sweep</button>}
        </div>
      )}

      {phase === "processing" || phase === "submitting" ? (
        <div className="room-sweep-status processing" role="status">
          <Map size={17} /><span><strong>{phase === "submitting" ? "Sending the sweep securely…" : "Processing room geometry…"}</strong><small>{generationQuery.data?.progress ?? 0}% complete · temporary frames are only used for this generation.</small></span>
        </div>
      ) : phase === "place-camera" ? (
        <div className="room-sweep-status place-camera" role="status">
          <CheckCircle2 size={17} /><span><strong>Relative 2D geometry is ready.</strong><small>Place the camera in its fixed position to finish setup.</small></span>
          <button type="button" className="secondary-button" onClick={confirmPlacement}>Camera is in its fixed spot <Check size={14} /></button>
        </div>
      ) : phase === "ready" ? (
        <div className="room-sweep-status ready" role="status">
          <CheckCircle2 size={17} /><span><strong>Camera-derived 2D map ready.</strong><small>Relative geometry saved · metric scale is not claimed.</small></span>
        </div>
      ) : null}

      <div className="publisher-actions">
        <button className="primary-button" onClick={stream ? togglePublisher : start} disabled={starting || (!stream && !consented)}>
          {stream ? (paused ? <Play size={16} /> : <Pause size={16} />) : <Video size={16} />} {actionLabel}
        </button>
        <span className="muted secure-note"><LockKeyhole size={14} /> Encrypted in transit · local network</span>
      </div>
    </section>
  );
}

export function stopCameraSetup(): void {
  stopActivePublisher();
  clearPublisherRegistry();
}
