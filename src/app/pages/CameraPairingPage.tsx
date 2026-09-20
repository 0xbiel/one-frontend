import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { api, cameraReconnectUrl, getCameraReconnect } from "../../api/client";
import { CameraSetupCard } from "../../camera/CameraSetupCard";

function sanitizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function PublisherPage({
  paused,
  onTogglePause,
}: {
  paused: boolean;
  onTogglePause: () => void;
}) {
  return (
    <div className="publisher-layout">
      <CameraSetupCard paused={paused} onTogglePause={onTogglePause} />
      <aside className="publisher-side">
        <div className="panel step-card">
          <span className="step-number">1</span>
          <div>
            <strong>Give consent</strong>
            <span className="muted">Before any permission prompt</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">2</span>
          <div>
            <strong>Start the preview</strong>
            <span className="muted">The camera can publish as soon as consent is granted</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">3</span>
          <div>
            <strong>Position it when you want</strong>
            <span className="muted">Calibration and room mapping only run from Position &amp; map</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function JoinPage() {
  const { code: pathCode } = useParams<{ code?: string }>();
  const [code, setCode] = useState(sanitizeCode(pathCode ?? ""));
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permanentUrl, setPermanentUrl] = useState("");
  const [permanentCopied, setPermanentCopied] = useState(false);
  const [error, setError] = useState("");

  // Pairing is durable on the backend.  A reload must not send a publisher
  // back to the one-time-code screen just because this component's React state
  // was recreated.
  useEffect(() => {
    if (!sessionStorage.getItem("one_access_token")) return;
    let cancelled = false;
    void api.getSession().then(async (session) => {
      if (!cancelled && session.actor.role === "publisher") {
        setConnected(true);
        let reconnectToken = getCameraReconnect(session.actor.id);
        if (!reconnectToken) {
          try {
            reconnectToken = (await api.createCameraReconnectLink()).reconnect_token;
          } catch {
            reconnectToken = null;
          }
        }
        if (reconnectToken) setPermanentUrl(cameraReconnectUrl(session.actor.id, reconnectToken));
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const copyPermanentUrl = async () => {
    if (!permanentUrl) return;
    try {
      await navigator.clipboard?.writeText(permanentUrl);
      setPermanentCopied(true);
      window.setTimeout(() => setPermanentCopied(false), 1800);
    } catch {
      setPermanentCopied(false);
    }
  };

  const continuePairing = async () => {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.completePairing(code);
      if (result.reconnect_token) setPermanentUrl(cameraReconnectUrl(result.user_id, result.reconnect_token));
      setConnected(true);
    } catch {
      setError("That pairing code is invalid or expired. Ask the caregiver for a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-page ios-auth-page camera-pairing-page">
      <main className={`camera-pairing-shell ${connected ? "is-connected" : ""}`}>
        <header className="ios-auth-header" aria-label="ONE"><img className="one-logo" src="/one-logo.png" alt="" aria-hidden="true" /><span className="wordmark">ONE</span></header>
        <section className={`camera-pairing-card ios-camera-card ${connected ? "is-connected" : ""}`}>
          <button className="camera-back-button" type="button" onClick={() => window.history.back()}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="ios-auth-symbol camera-pairing-symbol" aria-hidden="true"><Camera size={27} /></div>
          <span className="eyebrow ios-auth-eyebrow">PAIR A CAMERA</span>
          <h1>{connected ? "Camera connected." : "Pair this camera"}</h1>
          <p>
            {connected
              ? "Paired securely and saved to the household. Live view can start now; calibration and room mapping stay optional until you choose Position & map."
              : "Use the one-time code from the caregiver to connect this camera. This is device setup, not household sign-in."}
          </p>

          {connected ? (
            <div className="camera-joined-status" role="status">
              <span className="camera-joined-check"><Check size={13} /></span>
              <span><strong>Pairing complete · camera saved</strong><small>Next · consent and preview. Positioning stays optional.</small></span>
            </div>
          ) : (
            <div className="camera-flow-steps" aria-label="Camera pairing progress">
              <span className="current"><b>1</b> Pair</span>
              <i />
              <span><b>2</b> Consent</span>
              <i />
              <span><b>3</b> Preview</span>
            </div>
          )}

          {!connected && (
            <>
              <label className="camera-code-input" htmlFor="camera-pairing-code">
                Pairing code
                <input id="camera-pairing-code" aria-label="Enter a pairing code" value={code} onChange={(event) => setCode(sanitizeCode(event.target.value))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" autoFocus />
                <span>Ask the household admin for the six-digit code.</span>
              </label>
              <button className="primary-button full-width" onClick={continuePairing} disabled={busy || code.length !== 6}>
                <span>{busy ? "Connecting securely…" : "Connect this camera"}</span><ChevronRight size={16} />
              </button>
            </>
          )}

          {connected && code && (
            <div className="camera-code-card connected" role="status">
              <div className="camera-code-card-heading">
                <span className="eyebrow">CONNECTED WITH</span>
                <button type="button" className="icon-button" onClick={copyCode} aria-label="Copy pairing code">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
              <strong>{code}</strong>
              <span>{copied ? "Code copied" : "This one-time code is now linked to this device."}</span>
            </div>
          )}

          {connected && permanentUrl && (
            <div className="camera-permanent-link" role="status">
              <div>
                <span className="eyebrow">PERMANENT CAMERA LINK</span>
                <strong>Bookmark this device link</strong>
                <p>This camera can reopen the same household after a reload, closed tab, or expired session. Removing the camera revokes the link.</p>
              </div>
              <code>{permanentUrl}</code>
              <button type="button" className="secondary-button full-width" onClick={copyPermanentUrl}>
                {permanentCopied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy permanent link</>}
              </button>
            </div>
          )}

          {error && <div className="error-note" role="alert">{error}</div>}
        </section>

        {connected && <CameraSetupCard embedded />}

        <p className="camera-privacy-footer"><ShieldCheck size={14} /> Camera and microphone stay off until you choose consent.</p>
      </main>
    </div>
  );
}

export function CameraReconnectPage({
  paused,
  onTogglePause,
}: {
  paused: boolean;
  onTogglePause: () => void;
}) {
  const { cameraId = "" } = useParams<{ cameraId: string }>();
  const [state, setState] = useState<"connecting" | "connected" | "error">("connecting");

  useEffect(() => {
    let cancelled = false;
    const reconnect = async () => {
      const hashToken = new URLSearchParams(window.location.hash.slice(1)).get("key");
      const reconnectToken = hashToken || getCameraReconnect(cameraId);
      if (cameraId && reconnectToken) {
        try {
          await api.reconnectCamera(cameraId, reconnectToken);
          if (!cancelled) setState("connected");
          return;
        } catch {
          if (!cancelled) setState("error");
          return;
        }
      }
      try {
        const session = await api.getSession();
        if (!cancelled && session.actor.role === "publisher" && session.actor.id === cameraId) setState("connected");
        else if (!cancelled) setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void reconnect();
    return () => { cancelled = true; };
  }, [cameraId]);

  if (state === "connected") return <PublisherPage paused={paused} onTogglePause={onTogglePause} />;

  return (
    <div className="join-page camera-pairing-page">
      <section className="join-card camera-pairing-card panel">
        <div className="camera-pairing-brand" aria-label="ONE camera">
          <img className="one-logo large" src="/one-logo.png" alt="" aria-hidden="true" />
          <span className="camera-pairing-icon" aria-hidden="true"><Camera size={18} /></span>
        </div>
        <span className="eyebrow">SAVED CAMERA</span>
        <h1>{state === "connecting" ? "Rejoining camera…" : "Camera link unavailable"}</h1>
        <p className="muted">
          {state === "connecting"
            ? "ONE is restoring this camera’s saved household connection."
            : "This saved link is missing or has been revoked. Pair the camera again from Camera Manager."}
        </p>
        {state === "error" && <button className="primary-button full-width" onClick={() => window.location.assign("/join")}>Pair this camera again <ChevronRight size={16} /></button>}
      </section>
    </div>
  );
}
