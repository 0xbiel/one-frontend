import { LockKeyhole, RefreshCw, Trash2, Video, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, demoMode } from "../api/client";
import type { Device } from "../models/domain";
import { connectViewer, type ViewerConnection } from "../livekit/viewer";

export function LivePage() {
  const hasSession = demoMode || Boolean(sessionStorage.getItem("one_access_token"));
  const queryClient = useQueryClient();
  const camerasQuery = useQuery({ queryKey: ["cameras"], queryFn: api.getCameras, enabled: hasSession, retry: false });
  const cameras = useMemo(() => camerasQuery.data ?? [], [camerasQuery.data]);
  const [selectedId, setSelectedId] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [liveCameraId, setLiveCameraId] = useState<string | null>(null);
  const [viewerState, setViewerState] = useState<"idle" | "connecting" | "waiting" | "live" | "error">("idle");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const connectionRef = useRef<ViewerConnection | null>(null);

  useEffect(() => {
    if (selectedId && cameras.some((camera) => camera.id === selectedId)) return;
    setSelectedId(cameras[0]?.id);
  }, [cameras, selectedId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const selectedCamera = useMemo(() => cameras.find((camera) => camera.id === selectedId) ?? null, [cameras, selectedId]);
  const liveCamera = useMemo(() => cameras.find((camera) => camera.id === liveCameraId) ?? null, [cameras, liveCameraId]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    setLiveCameraId(null);
    setViewerError(null);
    setViewerState(selectedCamera ? (demoMode ? "waiting" : "connecting") : "idle");
    void connectionRef.current?.disconnect();
    connectionRef.current = null;

    if (!selectedCamera || demoMode) return () => { cancelled = true; };

    const connect = async () => {
      try {
        const livekit = await api.getLiveKitToken("subscribe");
        if (cancelled || abortController.signal.aborted) return;
        if (!livekit.url || !livekit.token || !videoRef.current) throw new Error("LIVE_VIEW_UNAVAILABLE");
        const connection = await connectViewer(livekit.url, livekit.token, videoRef.current, audioRef.current, {
          signal: abortController.signal,
          preferredIdentity: selectedCamera.id,
          onVideoParticipant: (identity) => {
            if (!cancelled) {
              setLiveCameraId(identity);
              setViewerState("live");
            }
          },
          onVideoEnded: () => { if (!cancelled) setViewerState("waiting"); },
          onDisconnected: () => {
            if (!cancelled) {
              setViewerState("error");
              setViewerError("The live channel disconnected. Try the connection again.");
            }
          },
        });
        if (cancelled) {
          await connection.disconnect();
        } else {
          connectionRef.current = connection;
          setViewerState((current) => current === "live" ? current : "waiting");
        }
      } catch (error) {
        if (!cancelled) {
          setViewerState("error");
          setViewerError(error instanceof Error && error.message === "LIVE_VIEW_UNAVAILABLE" ? "The secure live channel is not available yet." : "The camera could not be reached. Keep the camera page open and try again.");
        }
      }
    };
    void connect();
    return () => {
      cancelled = true;
      abortController.abort();
      const connection = connectionRef.current;
      connectionRef.current = null;
      void connection?.disconnect();
    };
  }, [retryCount, selectedCamera]);

  const removeCamera = async () => {
    if (!selectedCamera || !window.confirm(`Remove ${selectedCamera.label}? Its live access will stop on this household.`)) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await api.deleteCamera(selectedCamera.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cameras"] }),
        queryClient.invalidateQueries({ queryKey: ["camera"] }),
        queryClient.invalidateQueries({ queryKey: ["scene"] }),
        queryClient.invalidateQueries({ queryKey: ["current-map"] }),
      ]);
      setSelectedId(undefined);
    } catch {
      setRemoveError("The camera could not be removed. Nothing was changed.");
    } finally {
      setRemoving(false);
    }
  };

  const statusLabel = viewerState === "live" ? "Live" : viewerState === "connecting" ? "Connecting" : viewerState === "error" ? "Unavailable" : selectedCamera ? "Waiting" : "No camera";

  return (
    <div className="live-page">
      <section className="panel live-viewer">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CAREGIVER VIEWER · LIVEKIT</span>
            <h2>{selectedCamera?.label ?? "No camera connected"}</h2>
          </div>
          <span className={`live-chip ${viewerState === "live" ? "is-live" : "is-waiting"}`}><span className="status-dot" /> {statusLabel}</span>
        </div>
        <div className="viewer-stage">
          {demoMode ? (
            <div className="viewer-placeholder">
              <Video size={31} />
              <strong>Demo live preview</strong>
              <span>Live video is intentionally unavailable in demo mode.</span>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="live-video" autoPlay playsInline aria-label="Connected camera live view" />
              <audio ref={audioRef} autoPlay />
              {viewerState !== "live" && (
                <div className="viewer-overlay">
                  {viewerState === "error" ? <WifiOff size={31} /> : <RefreshCw size={31} className={viewerState === "connecting" ? "spin" : ""} />}
                  <strong>{viewerState === "error" ? "Live view unavailable" : selectedCamera ? "Waiting for the camera feed" : "Connect a camera first"}</strong>
                  <span>{viewerError ?? "The caregiver view subscribes only after the camera device has granted capture consent."}</span>
                  {viewerState === "error" && (
                    <button className="secondary-button" onClick={() => setRetryCount((value) => value + 1)}>
                      <RefreshCw size={15} /> Retry connection
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="viewer-controls">
          <span className="muted"><LockKeyhole size={14} /> Encrypted in transit</span>
          <span className="muted">{liveCamera?.label ?? selectedCamera?.label ?? "No active source"} · {liveCamera ? "Online" : statusLabel.toLowerCase()}</span>
          <button className="icon-button viewer-audio" onClick={() => setMuted((value) => !value)} disabled={!selectedCamera} aria-label={muted ? "Unmute camera audio" : "Mute camera audio"}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </section>
      <aside className="panel live-note">
        <span className="eyebrow">CONNECTED CAMERAS</span>
        <h3>Watch with context.</h3>
        <p className="muted">ONE keeps the live view purposeful. Meaningful events and object memory stay available when you do not need to watch.</p>
        {cameras.length > 0 ? (
          <label className="camera-picker">Camera
            <select value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value)} aria-label="Select camera">
              {cameras.map((camera: Device) => <option key={camera.id} value={camera.id}>{camera.label} · {camera.status}</option>)}
            </select>
          </label>
        ) : <p className="muted camera-empty">No cameras are connected to this household.</p>}
        {selectedCamera && (
          <button className="text-button danger remove-camera-button" onClick={() => void removeCamera()} disabled={removing}>
            <Trash2 size={15} /> {removing ? "Removing camera…" : "Remove this camera"}
          </button>
        )}
        {removeError && <div className="error-note" role="alert">{removeError}</div>}
      </aside>
    </div>
  );
}
