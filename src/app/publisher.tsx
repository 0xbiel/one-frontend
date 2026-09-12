import { useState } from "react";
import { ChevronRight, LockKeyhole, Video } from "lucide-react";

export function LivePage() {
  return (
    <div className="live-page">
      <section className="panel live-viewer">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CAREGIVER VIEWER · LIVEKIT</span>
            <h2>Hallway camera</h2>
          </div>
          <span className="live-chip"><span className="status-dot" /> Connected</span>
        </div>
        <div className="viewer-placeholder">
          <Video size={31} />
          <strong>Live view is ready</strong>
          <span>Demo mode shows a privacy-safe placeholder. The backend-issued LiveKit token attaches here.</span>
        </div>
        <div className="viewer-controls">
          <span className="muted"><LockKeyhole size={14} /> Encrypted in transit</span>
          <span className="muted">Hallway iPhone · Online</span>
        </div>
      </section>
      <aside className="panel live-note">
        <span className="eyebrow">A HUMAN MOMENT</span>
        <h3>Watch with context.</h3>
        <p className="muted">ONE keeps the live view purposeful. Meaningful events and object memory stay available when you do not need to watch.</p>
      </aside>
    </div>
  );
}

export function CalibrationPage() {
  const [step, setStep] = useState(0);
  const steps = [
    "Place the camera in its fixed spot.",
    "Point at the left floor marker.",
    "Point at the center floor marker.",
    "Point at the right floor marker.",
  ];
  const done = step >= steps.length;
  return (
    <div className="calibration-layout">
      <section className="panel calibration-main">
        <span className="eyebrow">FIXED CAMERA CALIBRATION</span>
        <h2>{done ? "Coverage looks good." : "Make this view familiar."}</h2>
        <p className="muted">ONE uses three simple anchors to estimate where observations sit in the room. You can review this later.</p>
        <div className="calibration-preview">
          <span className="crosshair">+</span>
          <span className="calibration-instruction">{done ? "Camera calibrated · estimated error 0.18m" : steps[step]}</span>
        </div>
        <div className="calibration-progress"><span style={{ width: `${Math.min(100, (step / steps.length) * 100)}%` }} /></div>
        <div className="calibration-actions">
          {!done && <button className="primary-button" onClick={() => setStep((value) => value + 1)}>{step === 0 ? "Start calibration" : "Confirm anchor"} <ChevronRight size={16} /></button>}
          {done && <button className="primary-button" onClick={() => window.location.assign("/publisher/live")}>Continue to publisher <ChevronRight size={16} /></button>}
          <span className="muted">Step {Math.min(step + 1, steps.length)} of {steps.length}</span>
        </div>
      </section>
      <aside className="panel calibration-help">
        <span className="eyebrow">WHY THIS MATTERS</span>
        <h3>Approximate, never overconfident.</h3>
        <p className="muted">When a point is uncertain, the caregiver sees a zone and a confidence radius instead of a false precision.</p>
      </aside>
    </div>
  );
}
