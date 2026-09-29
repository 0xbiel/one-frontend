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
  return <video ref={ref} autoPlay muted playsInline aria-label={`Imagen en directo de ${label}`} />;
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
      setError("La cámara necesita localhost o HTTPS y un navegador con acceso a dispositivos.");
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
      setError(name === "NotAllowedError" ? "Autoriza la cámara en el navegador para verla aquí." : name === "NotFoundError" || name === "OverconstrainedError" ? "No se encuentra esa cámara. Comprueba el cable y pulsa Buscar cámaras." : name === "NotReadableError" ? "Otro programa está usando la cámara. Ciérralo e inténtalo de nuevo." : "No se pudo abrir la cámara.");
    } finally { if (mounted.current) setBusy(false); }
  };

  const available = devices.length ? devices : [{ deviceId: "", label: "Cámara del ordenador" }];
  const chosen = available.find((item) => item.deviceId === selectedId) ?? available[0];
  const chosenId = selectedId || chosen.deviceId;
  const chosenStream = streams[chosenId] ?? (chosenId === "" ? streams.default : undefined);
  const connectedCount = Object.keys(streams).length;

  return <div className="dd-local-gallery">
    <div className="dd-camera-summary"><div><span className="dd-round big"><Camera/></span><span><strong>Cámaras de este ordenador</strong><small>{devices.length} detectadas · {connectedCount} en directo</small></span><span className="dd-online">◉ &nbsp;{connectedCount ? `${connectedCount} conectada${connectedCount === 1 ? "" : "s"}` : "Sin conectar"}</span><button className="dd-blue-button" onClick={() => void connect(chosenId)} disabled={busy}><Plus size={17}/> {busy ? "Conectando…" : "Conectar cámara"}</button></div><div><span className="dd-round big"><ShieldCheck/></span><span><strong>Prueba local y privada</strong><small>El vídeo se ve en este ordenador. No se envía a familiares ni a la IA.</small></span></div></div>
    {error && <p className="dd-local-error" role="alert">{error}</p>}
    <section className="dd-camera-feature dd-local-feature"><div className="dd-local-feature-head"><h2>{chosen.label || "Cámara del ordenador"} <small>{chosenStream ? "● En directo" : "● Sin conectar"}</small></h2>{chosenStream && <button onClick={() => close(chosenId)}><CameraOff size={15}/> Desconectar</button>}</div><div className="dd-local-stage">{chosenStream ? <CameraVideo stream={chosenStream} label={chosen.label || "cámara del ordenador"}/> : <div className="dd-local-empty"><Video size={42}/><strong>La cámara aparecerá aquí</strong><span>Conecta una cámara USB o usa la integrada y pulsa «Conectar cámara».</span></div>}</div></section>
    <div className="dd-camera-grid dd-local-grid">{available.map((device, index) => {
      const id = device.deviceId || "default";
      const stream = streams[id];
      return <button key={id || index} onClick={() => { setSelectedId(device.deviceId); if (!stream) void connect(device.deviceId); }} className={chosenId === device.deviceId ? "selected" : ""}><strong>{device.label || `Cámara ${index + 1}`} <small>{stream ? "● En directo" : "● Conectar"}</small></strong><div className="dd-local-tile">{stream ? <CameraVideo stream={stream} label={device.label || `cámara ${index + 1}`}/> : <span><Camera size={31}/>Pulsa para conectar</span>}</div></button>;
    })}</div>
    <button className="dd-manage-camera" onClick={() => void refresh()}><Settings size={19}/><span><strong>Buscar cámaras</strong><small>Actualiza la lista después de conectar una cámara USB. El navegador puede pedir permiso antes de mostrar su nombre.</small></span><RefreshCw size={17}/><ChevronRight size={17}/></button>
  </div>;
}
