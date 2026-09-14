import { useState } from "react";
import { ChevronRight, LockKeyhole, Pause, Play, ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import type { Consent } from "../models/domain";

export function PrivacyPage({ paused, onTogglePause, consents, setConsents }: { paused: boolean; onTogglePause: () => void; consents: Consent[]; setConsents: (consents: Consent[]) => void }) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const run = async (kind: "export" | "delete") => {
    if (kind === "delete" && !window.confirm("Delete the home’s stored clips and observations? This cannot be undone.")) return;
    setBusy(kind); setNotice(""); setError("");
    try {
      const result = kind === "export" ? await api.exportData() : await api.deleteData();
      const status = typeof result === "object" && result && "status" in result ? String(result.status) : "accepted";
      setNotice(kind === "export" ? `Export request ${status}.` : `Deletion request ${status}.`);
    } catch { setError(kind === "export" ? "The export could not be requested. Nothing was downloaded." : "The deletion request could not be submitted. No data was deleted."); }
    finally { setBusy(null); }
  };
  return <div className="privacy-page"><header className="page-heading-clean"><span className="eyebrow">PRIVACY</span><h2>Privacy & consent</h2><p>Keep camera, microphone, and sharing choices visible and easy to change at any time.</p></header><div className="privacy-layout"><section className="panel privacy-main"><div className="privacy-section-heading"><div><span className="eyebrow">CARE PERMISSIONS</span><h3>What ONE can use</h3></div><LockKeyhole size={21} className="muted" /></div><p className="intro-copy">Each permission is independent. Pausing care stops camera and microphone capture without changing your other settings.</p><div className="consent-list">{consents.map((consent) => <label className="consent-row" key={consent.purpose}><span><strong>{consent.label}</strong><span>{consent.description}</span></span><input type="checkbox" checked={consent.granted} onChange={() => setConsents(consents.map((item) => item.purpose === consent.purpose ? { ...item, granted: !item.granted } : item))} /><span className="toggle" aria-hidden="true" /></label>)}</div><div className="privacy-actions"><button className={`secondary-button ${paused ? "resume-action" : "pause-action"}`} onClick={onTogglePause}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume care" : "Pause camera & microphone"}</button><p className="muted">Pause is also available from the top bar.</p></div>{notice && <div className="success-note" role="status"><ShieldCheck size={17} />{notice}</div>}{error && <div className="error-note" role="alert">{error}</div>}</section><aside className="privacy-side"><div className="panel action-card"><span className="eyebrow">DATA ACCESS</span><h3>Export your data</h3><p className="muted">Receive observations, consent history, and stored clips in a portable package.</p><button className="text-button" onClick={() => void run("export")} disabled={busy !== null}>{busy === "export" ? "Requesting…" : <>Request export <ChevronRight size={15} /></>}</button></div><div className="panel action-card danger-card"><span className="eyebrow">DATA DELETION</span><h3>Delete home data</h3><p className="muted">Permanently remove stored clips and observations from this home.</p><button className="text-button danger" onClick={() => void run("delete")} disabled={busy !== null}>{busy === "delete" ? "Submitting…" : <>Request deletion <ChevronRight size={15} /></>}</button></div></aside></div></div>;
}
