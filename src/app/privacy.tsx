import { useState } from "react";
import { ChevronRight, LockKeyhole, Pause, Play, ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import type { Consent, Session } from "../models/domain";
import "./legalLinks.css";
import { downloadPrivacyExport } from "./privacyExport";

export function PrivacyPage({ session, paused, onTogglePause, consents, setConsents }: { session?: Session; paused: boolean; onTogglePause: () => void; consents: Consent[]; setConsents: (consents: Consent[]) => void }) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [typedHomeId, setTypedHomeId] = useState("");
  const owner = session?.actor.role === "admin";
  const homeId = session?.home.id;
  const closeConfirmation = () => { setShowConfirmation(false); setTypedHomeId(""); };
  const run = async (kind: "export" | "delete") => {
    if (!owner || !homeId || busy !== null) return;
    if (kind === "delete" && typedHomeId !== homeId) return;
    setBusy(kind); setNotice(""); setError("");
    try {
      if (kind === "export") {
        const result = await api.exportData();
        downloadPrivacyExport(result, homeId);
        setNotice("Your sanitized household JSON download has started.");
      } else {
        const result = await api.deleteData({ confirmed: true, confirmation_home_id: typedHomeId });
        closeConfirmation();
        setNotice(`Deletion request ${result.status}.`);
      }
    } catch {
      setError(kind === "export" ? "The export could not be downloaded. Please try again." : "Deletion could not be completed. Some cleanup may be pending; check the household before retrying.");
    } finally { setBusy(null); }
  };
  return <div className="privacy-page"><header className="page-heading-clean"><span className="eyebrow">PRIVACY</span><h2>Privacy & consent</h2><p>Keep camera and microphone choices visible and easy to change.</p><a className="privacy-notice-link" href="/legal/privacy-notice.html#privacy">Read privacy notice <ChevronRight size={16} /></a></header><div className="privacy-layout"><section className="panel privacy-main"><div className="privacy-section-heading"><div><span className="eyebrow">CARE PERMISSIONS</span><h3>What ONE can use</h3></div><LockKeyhole size={21} className="muted" /></div><p className="intro-copy">Each permission is independent. Pausing care stops camera and microphone capture without changing your other settings.</p><div className="consent-list">{consents.map((consent) => <label className="consent-row" key={consent.purpose}><span><strong>{consent.label}</strong><span>{consent.description}</span></span><input type="checkbox" checked={consent.granted} onChange={() => setConsents(consents.map((item) => item.purpose === consent.purpose ? { ...item, granted: !item.granted } : item))} /><span className="toggle" aria-hidden="true" /></label>)}</div><div className="privacy-actions"><button className={`secondary-button ${paused ? "resume-action" : "pause-action"}`} onClick={onTogglePause}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume care" : "Pause camera & microphone"}</button><p className="muted">Pause is also available from the top bar.</p></div>{notice && <div className="success-note" role="status"><ShieldCheck size={17} />{notice}</div>}{error && <div className="error-note" role="alert">{error}</div>}</section><aside className="privacy-side"><div className="panel action-card"><span className="eyebrow">DATA ACCESS</span><h3>Export your data</h3><p className="muted">Download currently retained household records as portable JSON, including consent history and media metadata. Credentials, recognition templates, and media bytes are excluded.</p><button className="text-button" onClick={() => void run("export")} disabled={!owner || !homeId || busy !== null}>{busy === "export" ? "Requesting…" : <>Download JSON <ChevronRight size={15} /></>}</button></div><div className="panel action-card danger-card"><span className="eyebrow">DATA DELETION</span><h3>Delete home data</h3><p className="muted">Permanently delete this household and its care records, devices, stored media, recognition templates, and access. This cannot be undone.</p><button className="text-button danger" onClick={() => { setTypedHomeId(""); setShowConfirmation(true); }} disabled={!owner || !homeId || busy !== null}>{busy === "delete" ? "Submitting…" : <>Request deletion <ChevronRight size={15} /></>}</button></div>{!owner && <p role="note" className="muted">Only the household owner (admin) can export or delete household data.</p>}</aside></div>{showConfirmation && <div className="modal-backdrop" role="presentation"><section className="panel event-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-delete-title" onKeyDown={(event) => { if (event.key === "Escape" && !busy) closeConfirmation(); }}><h3 id="privacy-delete-title">Confirm permanent household deletion</h3><p>This removes the household, care records, devices, stored media, recognition templates, and access. It cannot be undone.</p><p>Type this exact household ID to confirm:</p><code>{homeId}</code><label htmlFor="privacy-confirm-home">Household ID</label><input id="privacy-confirm-home" value={typedHomeId} onChange={(event) => setTypedHomeId(event.target.value)} autoComplete="off" autoFocus disabled={busy !== null} /><div className="privacy-actions"><button className="secondary-button" onClick={closeConfirmation} disabled={busy !== null}>Cancel</button><button className="primary-button danger" disabled={!owner || !homeId || typedHomeId !== homeId || busy !== null} onClick={() => void run("delete")}>{busy === "delete" ? "Deleting…" : "Permanently delete household"}</button></div></section></div>}</div>;
}
