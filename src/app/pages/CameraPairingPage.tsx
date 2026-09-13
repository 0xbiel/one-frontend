import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../api/client";
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
            <strong>Record a room walkthrough</strong>
            <span className="muted">Walk around slowly; no precision pan is required</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">3</span>
          <div>
            <strong>Place the camera</strong>
            <span className="muted">ONE keeps the camera paired even if mapping is skipped</span>
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
  const [error, setError] = useState("");

  // Pairing is durable on the backend.  A reload must not send a publisher
  // back to the one-time-code screen just because this component's React state
  // was recreated.
  useEffect(() => {
    let cancelled = false;
    void api.getSession().then((session) => {
      if (!cancelled && session.actor.role === "publisher") setConnected(true);
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

  const continuePairing = async () => {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      await api.completePairing(code);
      setConnected(true);
    } catch {
      setError("That pairing code is invalid or expired. Ask the caregiver for a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-page camera-pairing-page">
      <main className={`camera-pairing-shell ${connected ? "is-connected" : ""}`}>
        {!connected && (
          <aside className="camera-pairing-story" aria-label="Camera setup details">
            <div className="camera-story-mark">
              <Camera size={20} />
            </div>
            <span className="eyebrow">ONE · ROOM CAMERA</span>
            <h2>Connect the room in a few clear steps.</h2>
            <p>
              Pair this device first. Camera and microphone access stay off until
              you review and choose consent on this device.
            </p>
            <div className="camera-story-list">
              <div>
                <span><CheckCircle2 size={15} /></span>
                <p><strong>Pair once</strong><small>Use the six-digit code from the home admin.</small></p>
              </div>
              <div>
                <span><ShieldCheck size={15} /></span>
                <p><strong>Consent here</strong><small>Permissions are requested only after pairing.</small></p>
              </div>
              <div>
                <span><Camera size={15} /></span>
                <p><strong>Finish when ready</strong><small>Preview first, then record an optional room walkthrough.</small></p>
              </div>
            </div>
          </aside>
        )}

        <section className={`join-card camera-pairing-card panel ${connected ? "is-connected" : ""}`}>
          <button className="camera-back-button" type="button" onClick={() => window.history.back()}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="camera-pairing-brand" aria-label="ONE camera setup">
            <img className="one-logo large" src="/one-logo.png" alt="" aria-hidden="true" />
            <span className="camera-pairing-icon" aria-hidden="true"><Camera size={18} /></span>
          </div>
          <span className="eyebrow">PAIR A CAMERA</span>
          <h1>{connected ? "Camera connected." : "Bring ONE into the room."}</h1>
          <p className="muted">
            {connected
              ? "Paired securely and saved to the household. You can reload, stop, or finish mapping later without pairing this camera again."
              : "Use the one-time code from the caregiver to connect this camera. This is device setup, not household sign-in."}
          </p>

          {connected ? (
            <div className="camera-joined-status" role="status">
              <span className="camera-joined-check"><Check size={13} /></span>
              <span><strong>Pairing complete · camera saved</strong><small>Next · consent, preview, and optional room walkthrough</small></span>
            </div>
          ) : (
            <div className="camera-flow-steps" aria-label="Camera pairing progress">
              <span className="current"><b>1</b> Pair</span>
              <i />
              <span><b>2</b> Consent</span>
              <i />
              <span><b>3</b> Room</span>
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
                {busy ? "Connecting securely…" : "Connect this camera"} <ChevronRight size={16} />
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

          {error && <div className="error-note" role="alert">{error}</div>}
        </section>

        {connected && <CameraSetupCard embedded />}

        <p className="camera-privacy-footer"><ShieldCheck size={14} /> Camera and microphone stay off until you choose consent.</p>
      </main>
    </div>
  );
}
