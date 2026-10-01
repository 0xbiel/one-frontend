import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ChevronRight, Plus, RefreshCw, Settings, ShieldCheck, Video } from "lucide-react";
import "./LocalCameraGallery.css";

function CameraVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => { video.srcObject = null; };
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline aria-label={`Live preview from ${label}`} />;
}

export function LocalCameraGallery() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const streamsRef = useRef<Record<string, MediaStream>>({});
  const mounted = useRef(true);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === "videoinput")); }
    catch { setDevices([]); }
  };

  useEffect(() => {
    mounted.current = true;
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      mounted.current = false;
      Object.values(streamsRef.current).forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      streamsRef.current = {};
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, []);

  const close = (id: string) => {
    streamsRef.current[id]?.getTracks().forEach((track) => track.stop());
    const remaining = { ...streamsRef.current };
    delete remaining[id];
    streamsRef.current = remaining;
    setStreams(remaining);
  };

  const connect = async (id = selectedId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires localhost or HTTPS and a browser that supports media devices.");
      return;
    }
    if (busy) return;
    if (id && streamsRef.current[id]) { setSelectedId(id); return; }
    setBusy(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id } } : true, audio: false });
      if (!mounted.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const actualId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || id || "default";
      streamsRef.current = { ...streamsRef.current, [actualId]: stream };
      setStreams(streamsRef.current);
      setSelectedId(actualId);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => { if (streamsRef.current[actualId] === stream) close(actualId); });
      void refresh();
    } catch (cause) {
      if (!mounted.current) return;
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "Allow camera access in your browser to view it here." : name === "NotFoundError" || name === "OverconstrainedError" ? "That camera could not be found. Check the connection and select Find cameras." : name === "NotReadableError" ? "Another app is using the camera. Close it and try again." : "The camera could not be opened.");
    } finally { if (mounted.current) setBusy(false); }
  };

  const available = devices.length ? devices : [{ deviceId: "", label: "Computer camera" }];
  const chosen = available.find((item) => item.deviceId === selectedId) ?? available[0];
  const chosenId = selectedId || chosen.deviceId;
  const chosenStream = streams[chosenId] ?? (chosenId === "" ? streams.default : undefined);
  const connectedCount = Object.keys(streams).length;

  return <div className="dd-local-gallery">
    <div className="dd-camera-summary"><div><span className="dd-round big"><Camera/></span><span><strong>This computer’s cameras</strong><small>{devices.length} detected · {connectedCount} live</small></span><span className="dd-online">◉ &nbsp;{connectedCount ? `${connectedCount} connected` : "Not connected"}</span><button className="dd-blue-button" onClick={() => void connect(chosenId)} disabled={busy}><Plus size={17}/> {busy ? "Connecting…" : "Connect camera"}</button></div><div><span className="dd-round big"><ShieldCheck/></span><span><strong>Local and private preview</strong><small>Video stays on this computer. It is not sent to family or AI.</small></span></div></div>
    {error && <p className="dd-local-error" role="alert">{error}</p>}
    <section className="dd-camera-feature dd-local-feature"><div className="dd-local-feature-head"><h2>{chosen.label || "Computer camera"} <small>{chosenStream ? "● Live" : "● Not connected"}</small></h2>{chosenStream && <button onClick={() => close(chosenId)}><CameraOff size={15}/> Disconnect</button>}</div><div className="dd-local-stage">{chosenStream ? <CameraVideo stream={chosenStream} label={chosen.label || "computer camera"}/> : <div className="dd-local-empty"><Video size={42}/><strong>Your camera preview will appear here</strong><span>Connect a USB or built-in camera, then select “Connect camera”.</span></div>}</div></section>
    <div className="dd-camera-grid dd-local-grid">{available.map((device, index) => {
      const id = device.deviceId || "default";
      const stream = streams[id];
      return <button key={id || index} onClick={() => { setSelectedId(device.deviceId); if (!stream) void connect(device.deviceId); }} className={chosenId === device.deviceId ? "selected" : ""}><strong>{device.label || `Camera ${index + 1}`} <small>{stream ? "● Live" : "● Connect"}</small></strong><div className="dd-local-tile">{stream ? <CameraVideo stream={stream} label={device.label || `camera ${index + 1}`}/> : <span><Camera size={31}/>Select to connect</span>}</div></button>;
    })}</div>
    <button className="dd-manage-camera" onClick={() => void refresh()}><Settings size={19}/><span><strong>Find cameras</strong><small>Refresh the list after connecting a USB camera. Your browser may ask for permission before showing device names.</small></span><RefreshCw size={17}/><ChevronRight size={17}/></button>
  </div>;
}
