import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  LockKeyhole,
  Pause,
  Play,
  ShieldCheck,
  Video,
} from "lucide-react";
import { api, demoMode } from "../../api/client";
import type { PublisherConnection } from "../../livekit/publisher";
import {
  clearPublisherRegistry,
  registerPublisherConnection,
  registerPublisherStream,
  stopActivePublisher,
} from "../../livekit/registry";

type CameraSetupCardProps = {
  embedded?: boolean;
  paused?: boolean;
  onTogglePause?: () => void;
};

function CameraSetupCard({
  embedded = false,
  paused = false,
  onTogglePause,
}: CameraSetupCardProps) {
  const [consented, setConsented] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connection, setConnection] = useState<PublisherConnection | null>(
    null,
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const stop = () => {
    stopActivePublisher();
    setStream(null);
    setConnection(null);
  };

  const togglePublisher = () => {
    if (onTogglePause) {
      if (!paused) stop();
      onTogglePause();
      return;
    }
    stop();
  };

  const start = async () => {
    if (starting || stream || !consented) return;
    setStarting(true);
    setError("");
    try {
      const livekit = !demoMode ? await api.getLiveKitToken("publish") : null;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("SECURE_CONTEXT_REQUIRED");
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      registerPublisherStream(media);
      setStream(media);
      if (livekit?.url && livekit.token) {
        const { connectPublisher } = await import("../../livekit/publisher");
        const liveConnection = await connectPublisher(livekit.url, livekit.token, media);
        registerPublisherConnection(liveConnection.disconnect);
        setConnection(liveConnection);
      }
    } catch {
      stopActivePublisher();
      setStream(null);
      setConnection(null);
      setError(
        "Camera or microphone permission was not granted, or the secure room was unavailable. You can retry safely.",
      );
    } finally {
      setStarting(false);
    }
  };

  useEffect(
    () => () => {
      stopActivePublisher();
      clearPublisherRegistry();
    },
    [],
  );

  const step = stream ? 3 : consented ? 2 : 1;
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
    <section
      className={`panel publisher-card camera-setup-card ${embedded ? "camera-setup-embedded" : ""}`}
    >
      <div className="publisher-heading">
        <div className="camera-setup-title-row">
          <span className="camera-setup-icon" aria-hidden="true">
            <Camera size={19} />
          </span>
          <span>
            <span className="eyebrow">CAMERA SETUP</span>
            <strong>Finish on this device</strong>
          </span>
        </div>
        <h2>{stream ? "Your view is ready." : "A clear view, with consent."}</h2>
        <p>
          {stream
            ? "Keep this device in its fixed spot. You can pause the preview any time."
            : "Give ONE permission only after you know what this device will share."}
        </p>
      </div>

      <div className="camera-setup-progress" aria-label="Camera setup progress">
        {["Consent", "Preview", "Ready"].map((label, index) => {
          const number = index + 1;
          return (
            <span
              className={number < step ? "complete" : number === step ? "current" : ""}
              key={label}
            >
              <span>{number < step ? <Check size={12} /> : number}</span>
              {label}
            </span>
          );
        })}
      </div>

      {stream ? (
        <div className="video-preview">
          <video ref={videoRef} autoPlay muted playsInline />
          <span className="recording-pill">
            <span className="record-dot" /> Preview only · {connection ? "LiveKit connected" : demoMode ? "demo" : "connecting"}
          </span>
        </div>
      ) : (
        <div className="camera-placeholder camera-setup-placeholder">
          <Camera size={30} />
          <span>Preview appears after consent</span>
        </div>
      )}

      <label className="publisher-consent camera-consent">
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => {
            const next = event.target.checked;
            setConsented(next);
            if (!next && stream) stop();
          }}
        />
        <span>
          I understand what is shared and consent to camera and microphone capture
          for this household.
        </span>
      </label>

      {error && (
        <div className="error-note" role="alert">
          {error}
        </div>
      )}

      <div className="publisher-actions">
        <button
          className="primary-button"
          onClick={stream ? togglePublisher : start}
          disabled={starting || (!stream && !consented)}
        >
          {stream ? (paused ? <Play size={16} /> : <Pause size={16} />) : <Video size={16} />}
          {actionLabel}
        </button>
        <span className="muted secure-note">
          <LockKeyhole size={14} /> Encrypted in transit · local network
        </span>
      </div>
    </section>
  );
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
            <strong>Keep the preview live</strong>
            <span className="muted">Place the device in its fixed spot</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">3</span>
          <div>
            <strong>Calibrate once</strong>
            <span className="muted">Point at three familiar anchors</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function sanitizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
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
      setError(
        "That pairing code is invalid or expired. Ask the caregiver for a new one.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-page camera-pairing-page">
      <main className="camera-pairing-shell">
        <section className="join-card camera-pairing-card panel">
          <button
            className="camera-back-button"
            type="button"
            onClick={() => window.history.back()}
          >
            <ArrowLeft size={15} /> Back
          </button>
          <div className="camera-pairing-brand" aria-label="ONE camera setup">
            <span className="brand-mark large">O</span>
            <span className="camera-pairing-icon" aria-hidden="true">
              <Camera size={18} />
            </span>
          </div>
          <span className="eyebrow">PAIR A CAMERA</span>
          <h1>{connected ? "Camera connected." : "Bring ONE into the room."}</h1>
          <p className="muted">
            {connected
              ? "This device is linked. Keep the code visible while you finish the consented preview below."
              : "Use the one-time code from the caregiver to connect this camera. This is device setup, not household sign-in."}
          </p>

          <div className="camera-flow-steps" aria-label="Camera pairing progress">
            <span className={connected ? "complete" : "current"}>
              <b>{connected ? <Check size={12} /> : "1"}</b> Pair
            </span>
            <i />
            <span className={connected ? "current" : ""}>
              <b>2</b> Consent
            </span>
            <i />
            <span>
              <b>3</b> Preview
            </span>
          </div>

          {!connected && (
            <>
              <label className="camera-code-input" htmlFor="camera-pairing-code">
                Pairing code
                <input
                  id="camera-pairing-code"
                  aria-label="Enter a pairing code"
                  value={code}
                  onChange={(event) => setCode(sanitizeCode(event.target.value))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <span>Ask the household admin for the six-digit code.</span>
              </label>
              <button
                className="primary-button full-width"
                onClick={continuePairing}
                disabled={busy || code.length !== 6}
              >
                {busy ? "Connecting securely…" : "Connect this camera"} <ChevronRight size={16} />
              </button>
            </>
          )}

          {connected && (
            <div className="camera-code-card connected" role="status">
              <div className="camera-code-card-heading">
                <span className="eyebrow">CONNECTED WITH</span>
                <button type="button" className="icon-button" onClick={copyCode} aria-label="Copy pairing code">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <strong>{code}</strong>
              <span>{copied ? "Code copied" : "This one-time code is now linked to this device."}</span>
            </div>
          )}

          {error && (
            <div className="error-note" role="alert">
              {error}
            </div>
          )}
        </section>

        {connected && (
          <>
            <div className="camera-connected-note" role="status">
              <CheckCircle2 size={17} />
              <span>
                <strong>Connection confirmed</strong>
                <small>Your setup stays on this page. Nothing else opens in another tab.</small>
              </span>
            </div>
            <CameraSetupCard embedded />
          </>
        )}

        <p className="camera-privacy-footer">
          <ShieldCheck size={14} /> Camera and microphone stay off until you choose consent.
        </p>
      </main>
    </div>
  );
}
