import {
  Camera,
  Check,
  Copy,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, demoMode } from "../api/client";
import type { Device } from "../models/domain";
import { connectViewer, type ViewerConnection } from "../livekit/viewer";

type Pairing = { pairing_id: string; code: string; expires_at: string };

export function CameraManagerPage() {
  const hasSession = demoMode || Boolean(sessionStorage.getItem("one_access_token"));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCameraId = searchParams.get("camera");
  const requestedCameraIds = useMemo(
    () => (searchParams.get("cameras") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    [searchParams],
  );
  const queryClient = useQueryClient();
  const camerasQuery = useQuery({ queryKey: ["cameras"], queryFn: api.getCameras, enabled: hasSession, retry: false, refetchInterval: 5_000 });
  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: api.getRooms, enabled: hasSession, retry: false });
  const cameras = useMemo(() => camerasQuery.data ?? [], [camerasQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const scopedCameras = useMemo(() => {
    if (!requestedCameraIds.length) return cameras;
    const requested = new Set(requestedCameraIds);
    const matches = cameras.filter((camera) => requested.has(camera.id));
    return matches.length ? matches : cameras;
  }, [cameras, requestedCameraIds]);
  const mapScopeActive = requestedCameraIds.length > 0 && scopedCameras.length < cameras.length;
  const [selectedId, setSelectedId] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [liveCameraId, setLiveCameraId] = useState<string | null>(null);
  const [viewerState, setViewerState] = useState<"idle" | "connecting" | "waiting" | "live" | "error">("idle");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingCopied, setPairingCopied] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const connectionRef = useRef<ViewerConnection | null>(null);

  const pairingStatusQuery = useQuery({
    queryKey: ["camera-manager-pairing", pairing?.pairing_id],
    queryFn: () => api.getPairingStatus(pairing!.pairing_id),
    enabled: Boolean(pairing?.pairing_id),
    refetchInterval: (query) => query.state.data?.status === "pending" ? 2_000 : false,
    retry: false,
  });

  useEffect(() => {
    if (pairingStatusQuery.data?.status !== "connected") return;
    void queryClient.invalidateQueries({ queryKey: ["cameras"] });
  }, [pairingStatusQuery.data?.status, queryClient]);

  useEffect(() => {
    if (requestedCameraId && scopedCameras.some((camera) => camera.id === requestedCameraId)) {
      if (selectedId !== requestedCameraId) setSelectedId(requestedCameraId);
      return;
    }
    if (selectedId && scopedCameras.some((camera) => camera.id === selectedId)) return;
    setSelectedId(scopedCameras[0]?.id);
  }, [requestedCameraId, scopedCameras, selectedId]);

  const selectCamera = (cameraId: string) => {
    setSelectedId(cameraId);
    const next = new URLSearchParams(searchParams);
    next.set("camera", cameraId);
    setSearchParams(next, { replace: true });
  };

  const clearMapCameraScope = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("cameras");
    setSearchParams(next, { replace: true });
  };

  const selectedCamera = useMemo(() => cameras.find((camera) => camera.id === selectedId) ?? null, [cameras, selectedId]);
  const liveCamera = useMemo(() => cameras.find((camera) => camera.id === liveCameraId) ?? null, [cameras, liveCameraId]);
  const roomName = (roomId?: string | null) => rooms.find((room) => room.id === roomId)?.name ?? "Unassigned";

  useEffect(() => {
    setNameDraft(selectedCamera?.label ?? "");
    setEditingName(false);
    setNameError(null);
  }, [selectedCamera?.id, selectedCamera?.label]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

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

  const startPairing = async () => {
    if (pairingBusy) return;
    setPairingBusy(true);
    setPairingError(null);
    setPairingCopied(false);
    try {
      setPairing(await api.createPairing("Room camera"));
    } catch {
      setPairingError("ONE could not create a camera code. Check your caregiver session and try again.");
    } finally {
      setPairingBusy(false);
    }
  };

  const copyPairingLink = async () => {
    if (!pairing) return;
    const link = `${window.location.origin}/join/${pairing.code}`;
    try {
      await navigator.clipboard?.writeText(link);
      setPairingCopied(true);
      window.setTimeout(() => setPairingCopied(false), 1800);
    } catch {
      setPairingError("Copy is unavailable here. Enter the six-digit code on the camera device instead.");
    }
  };

  const saveCameraName = async () => {
    if (!selectedCamera || !nameDraft.trim() || savingName) return;
    setSavingName(true);
    setNameError(null);
    try {
      await api.updateCamera(selectedCamera.id, { name: nameDraft.trim() });
      await queryClient.invalidateQueries({ queryKey: ["cameras"] });
      setEditingName(false);
    } catch {
      setNameError("The camera name could not be saved. Nothing else was changed.");
    } finally {
      setSavingName(false);
    }
  };

  const saveCameraRoom = async (roomId: string) => {
    if (!selectedCamera || savingRoom) return;
    setSavingRoom(true);
    setNameError(null);
    try {
      await api.updateCamera(selectedCamera.id, { room_id: roomId || null });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cameras"] }),
        queryClient.invalidateQueries({ queryKey: ["camera"] }),
        queryClient.invalidateQueries({ queryKey: ["scene"] }),
      ]);
    } catch {
      setNameError("The room assignment could not be saved.");
    } finally {
      setSavingRoom(false);
    }
  };

  const removeCamera = async () => {
    if (!selectedCamera || !window.confirm(`Remove ${selectedCamera.label}? Its permanent reconnect link and live access will stop.`)) return;
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
  const pairingStatus = pairingStatusQuery.data?.status;

  return (
    <div className="camera-manager-page">
      <header className="camera-manager-heading">
        <div>
          <span className="eyebrow">CAMERAS</span>
          <h2>Camera Manager</h2>
          <p>See every paired camera, check its connection, rename it, watch the live view, or revoke it from this household.</p>
        </div>
        <div className="camera-manager-heading-actions">
          <a className="secondary-button" href="/join" target="_blank" rel="noopener noreferrer">Use this computer as a camera</a>
          <button className="primary-button" onClick={() => void startPairing()} disabled={pairingBusy}>
            <Plus size={16} /> {pairingBusy ? "Creating code…" : "Pair camera"}
          </button>
        </div>
      </header>

      {pairing && (
        <section className={`panel manager-pairing-card ${pairingStatus === "connected" ? "is-connected" : ""}`}>
          <div className="manager-pairing-copy">
            <span className="manager-icon"><Camera size={18} /></span>
            <div>
              <span className="eyebrow">PAIR A NEW CAMERA</span>
              <h3>{pairingStatus === "connected" ? "Camera joined this household" : "Open the camera link on the device"}</h3>
              <p>{pairingStatus === "connected" ? "The device is saved. Its own screen now provides a permanent reconnect URL." : "The code is one use only. Camera and microphone stay off until consent is chosen on that device."}</p>
            </div>
          </div>
          <div className="manager-pairing-code">
            <strong>{pairing.code}</strong>
            <span className={`camera-status ${pairingStatus === "connected" ? "online" : ""}`}><i /> {pairingStatus === "connected" ? "Connected" : pairingStatus === "expired" ? "Expired" : "Waiting"}</span>
          </div>
          <div className="manager-pairing-actions">
            {pairingStatus !== "expired" && pairingStatus !== "connected" && (
              <a className="secondary-button" href={`/join/${pairing.code}`} target="_blank" rel="noopener noreferrer">Open on this computer</a>
            )}
            <button className="secondary-button" onClick={() => void copyPairingLink()} disabled={pairingStatus === "expired"}>
              {pairingCopied ? <><Check size={15} /> Camera link copied</> : <><Copy size={15} /> Copy camera link</>}
            </button>
          </div>
        </section>
      )}
      {pairingError && <div className="error-note camera-manager-error" role="alert">{pairingError}</div>}

      <div className="camera-manager-layout">
        <aside className="panel camera-list-panel">
          <div className="camera-list-heading">
            <span className="eyebrow">CONNECTED DEVICES</span>
            <strong>{scopedCameras.length} {scopedCameras.length === 1 ? "camera" : "cameras"}</strong>
          </div>
          {mapScopeActive && (
            <div className="camera-map-scope" role="status">
              <span><strong>Map selection</strong>{scopedCameras.length} camera{scopedCameras.length === 1 ? "" : "s"} cover this area.</span>
              <button type="button" className="text-button" onClick={clearMapCameraScope}>Show all</button>
            </div>
          )}
          <div className="camera-manager-list">
            {scopedCameras.map((camera: Device) => (
              <button key={camera.id} className={`camera-manager-row ${camera.id === selectedId ? "active" : ""}`} onClick={() => selectCamera(camera.id)}>
                <span className="camera-row-icon"><Video size={17} /></span>
                <span className="camera-row-copy"><strong>{camera.label}</strong><small>{roomName(camera.roomId)}</small></span>
                <span className={`camera-status ${camera.status === "online" ? "online" : camera.status === "paused" ? "paused" : ""}`}><i /> {camera.status}</span>
              </button>
            ))}
            {!scopedCameras.length && (
              <div className="camera-manager-empty">
                <Camera size={28} />
                <strong>No cameras paired</strong>
                <span>Pair a phone, tablet, or laptop to add a room view.</span>
              </div>
            )}
          </div>
        </aside>

        <div className="camera-manager-detail">
          <section className="panel live-viewer">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">LIVE VIEW</span>
                <h2>{selectedCamera?.label ?? "Select a camera"}</h2>
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
                      <strong>{viewerState === "error" ? "Live view unavailable" : selectedCamera ? "Waiting for the camera feed" : "Pair or select a camera"}</strong>
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

          <section className="panel camera-settings-card">
            <div className="camera-settings-heading">
              <div><span className="eyebrow">CAMERA DETAILS</span><h3>{selectedCamera ? "Manage this camera" : "No camera selected"}</h3></div>
              {selectedCamera && !editingName && <button className="icon-button" onClick={() => setEditingName(true)} aria-label="Rename camera"><Pencil size={15} /></button>}
            </div>
            {selectedCamera ? (
              <>
                <div className="camera-detail-grid">
                  <div><span>Status</span><strong className={`camera-detail-status ${selectedCamera.status}`}>{selectedCamera.status}</strong></div>
                  <div><span>Type</span><strong>{selectedCamera.platform || "Browser camera"}</strong></div>
                  <div><span>Room</span><strong>{roomName(selectedCamera.roomId)}</strong></div>
                  <div><span>Paired</span><strong>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(selectedCamera.lastSeenAt))}</strong></div>
                </div>
                <label className="camera-name-field">Camera name
                  <div>
                    <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={!editingName || savingName} />
                    {editingName && <button className="primary-button" onClick={() => void saveCameraName()} disabled={!nameDraft.trim() || savingName}><Save size={14} /> {savingName ? "Saving…" : "Save"}</button>}
                  </div>
                </label>
                <label className="camera-name-field">Room
                  <select
                    value={selectedCamera.roomId ?? ""}
                    onChange={(event) => void saveCameraRoom(event.target.value)}
                    disabled={savingRoom}
                  >
                    <option value="">Unassigned</option>
                    {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                  </select>
                </label>
                <div className="camera-reconnect-note"><LockKeyhole size={15} /><span><strong>Permanent camera reconnect</strong><small>The camera device keeps a private reconnect link after pairing. Reloads and normal session expiry return to this same camera; removing it revokes that link.</small></span></div>
                {nameError && <div className="error-note" role="alert">{nameError}</div>}
                <button className="secondary-button danger-button" onClick={() => void removeCamera()} disabled={removing}>
                  <Trash2 size={15} /> {removing ? "Removing camera…" : "Remove camera"}
                </button>
                {removeError && <div className="error-note" role="alert">{removeError}</div>}
              </>
            ) : <p className="muted">Pair a camera to manage its settings here.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

export const LivePage = CameraManagerPage;
