import { useState } from "react";
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
            <strong>Take the guided sweep</strong>
            <span className="muted">ONE samples the same approved preview</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">3</span>
          <div>
            <strong>Place the camera</strong>
            <span className="muted">A relative 2D map appears when ready</span>
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
      <main className="camera-pairing-shell">
        <section className="join-card camera-pairing-card panel">
          <button className="camera-back-button" type="button" onClick={() => window.history.back()}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="camera-pairing-brand" aria-label="ONE camera setup">
            <span className="brand-mark large">O</span>
            <span className="camera-pairing-icon" aria-hidden="true"><Camera size={18} /></span>
          </div>
          <span className="eyebrow">PAIR A CAMERA</span>
          <h1>{connected ? "Camera connected." : "Bring ONE into the room."}</h1>
          <p className="muted">
            {connected
              ? "This device is linked. Keep the code visible while you finish the consented preview and room sweep below."
              : "Use the one-time code from the caregiver to connect this camera. This is device setup, not household sign-in."}
          </p>

          <div className="camera-flow-steps" aria-label="Camera pairing progress">
            <span className={connected ? "complete" : "current"}><b>{connected ? <Check size={12} /> : "1"}</b> Pair</span>
            <i />
            <span className={connected ? "current" : ""}><b>2</b> Consent</span>
            <i />
            <span className={connected ? "current" : ""}><b>3</b> Map</span>
          </div>

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

          {connected && (
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

        {connected && (
          <>
            <div className="camera-connected-note" role="status">
              <CheckCircle2 size={17} />
              <span><strong>Connection confirmed</strong><small>Your setup stays on this page. Nothing else opens in another tab.</small></span>
            </div>
            <CameraSetupCard embedded />
          </>
        )}

        <p className="camera-privacy-footer"><ShieldCheck size={14} /> Camera and microphone stay off until you choose consent.</p>
      </main>
    </div>
  );
}
