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
    const video = videoRef.current;
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      requestId.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
    };
  }, []);

  const start = async (selected = deviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access the camera here. Open the site on localhost in Chrome or Edge.");
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
      setError(name === "NotAllowedError" ? "Allow camera access in your browser and try again." : name === "NotFoundError" || name === "OverconstrainedError" ? "That camera could not be found. Connect it and select “Find cameras”." : name === "NotReadableError" ? "Another app is using the camera. Close it and try again." : "The camera could not be opened. Check its connection and your browser permissions.");
    }
  };

  return <section className="one-local-camera" aria-label="Local computer camera preview">
    <div className="one-local-camera-heading"><div><span>LOCAL PREVIEW · COMPUTER CAMERA</span><h2>Connect and test your camera</h2><p>Choose a USB or built-in camera to see a live preview. The video stays on this computer; it is not sent to the Hub or other users.</p></div><span className={`one-local-camera-status ${state}`}>{state === "live" ? "● Live" : state === "starting" ? "Starting…" : "Camera off"}</span></div>
    <div className="one-local-camera-controls"><label>Camera <select value={deviceId} onChange={(event) => { setDeviceId(event.target.value); if (state === "live") void start(event.target.value); }}><option value="">Default camera</option>{devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label><button type="button" onClick={() => void refreshDevices()}><RefreshCw size={16}/> Find cameras</button>{state === "live" ? <button type="button" className="primary" onClick={stop}><CameraOff size={17}/> Turn camera off</button> : <button type="button" className="primary" disabled={state === "starting"} onClick={() => void start()}><Camera size={17}/> {state === "starting" ? "Starting…" : "Connect camera"}</button>}</div>
    <div className="one-local-camera-stage"><video ref={videoRef} autoPlay muted playsInline aria-label="Live preview from this computer’s camera" />{state !== "live" && <div className="one-local-camera-placeholder"><Camera size={31}/><strong>The camera is off</strong><span>It will only turn on when you select “Connect camera”.</span></div>}</div>
    {error && <p className="one-local-camera-error" role="alert">{error}</p>}
  </section>;
}
