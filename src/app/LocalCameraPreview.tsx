import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";
import "./LocalCameraPreview.css";

export function LocalCameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestId = useRef(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [state, setState] = useState<"off" | "starting" | "live">("off");
  const [error, setError] = useState("");

  const stop = () => {
    requestId.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("off");
  };

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput"));
    } catch { setDevices([]); }
  };

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      requestId.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
    };
  }, []);

  const start = async (selected = deviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("El navegador no permite acceder a la cámara aquí. Abre la web en localhost con Chrome o Edge.");
      return;
    }
    stop();
    const currentRequest = requestId.current;
    setError("");
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: selected ? { deviceId: { exact: selected } } : true, audio: false });
      if (currentRequest !== requestId.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      stream.getVideoTracks()[0]?.addEventListener("ended", () => { if (streamRef.current === stream) stop(); });
      setState("live");
      void refreshDevices();
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setState("off");
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "Permite el acceso a la cámara en el navegador y vuelve a intentarlo." : name === "NotFoundError" || name === "OverconstrainedError" ? "No se encuentra esa cámara. Conéctala y pulsa «Buscar cámaras»." : name === "NotReadableError" ? "Otro programa está usando la cámara. Ciérralo y vuelve a intentarlo." : "No se pudo abrir la cámara. Comprueba la conexión y los permisos del navegador.");
    }
  };

  return <section className="one-local-camera" aria-label="Prueba de cámara de este ordenador">
    <div className="one-local-camera-heading"><div><span>PRUEBA LOCAL · CÁMARA DEL ORDENADOR</span><h2>Conecta y prueba tu cámara</h2><p>Elige una cámara USB o integrada y mira su imagen en directo. Esta prueba se ve solo en este ordenador; no envía vídeo al Hub ni a otros usuarios.</p></div><span className={`one-local-camera-status ${state}`}>{state === "live" ? "● En directo" : state === "starting" ? "Conectando…" : "Cámara apagada"}</span></div>
    <div className="one-local-camera-controls"><label>Cámara <select value={deviceId} onChange={(event) => { setDeviceId(event.target.value); if (state === "live") void start(event.target.value); }}><option value="">Cámara predeterminada</option>{devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Cámara ${index + 1}`}</option>)}</select></label><button type="button" onClick={() => void refreshDevices()}><RefreshCw size={16}/> Buscar cámaras</button>{state === "live" ? <button type="button" className="primary" onClick={stop}><CameraOff size={17}/> Apagar cámara</button> : <button type="button" className="primary" disabled={state === "starting"} onClick={() => void start()}><Camera size={17}/> {state === "starting" ? "Conectando…" : "Conectar cámara"}</button>}</div>
    <div className="one-local-camera-stage"><video ref={videoRef} autoPlay muted playsInline aria-label="Imagen en directo de la cámara de este ordenador" />{state !== "live" && <div className="one-local-camera-placeholder"><Camera size={31}/><strong>La cámara está apagada</strong><span>Solo se activará cuando pulses «Conectar cámara».</span></div>}</div>
    {error && <p className="one-local-camera-error" role="alert">{error}</p>}
  </section>;
}
