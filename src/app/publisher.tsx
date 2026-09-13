import { LockKeyhole, Video } from "lucide-react";

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
