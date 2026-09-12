import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Home,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "../../api/client";

export function HouseholdInvitePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.acceptFamilyInvite(code, name, email);
      navigate("/onboarding", { replace: true });
    } catch {
      setError(
        "That invitation is invalid or expired. Ask the home admin for a new one.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-page household-join-page">
      <main className="household-join-shell">
        <aside className="household-join-story" aria-label="Household sharing details">
          <div className="household-story-mark">
            <Home size={19} />
          </div>
          <span className="eyebrow">ONE · SHARED CARE</span>
          <h2>A shared home, thoughtfully connected.</h2>
          <p>
            Join the people who already help care for this home. Your role stays
            clear, and the home admin remains in control.
          </p>
          <div className="household-story-list">
            <div>
              <span><Users size={15} /></span>
              <p><strong>One circle</strong><small>See the moments and reminders shared with you.</small></p>
            </div>
            <div>
              <span><ShieldCheck size={15} /></span>
              <p><strong>Purposeful access</strong><small>Only the permissions your household gives you.</small></p>
            </div>
            <div>
              <span><Check size={15} /></span>
              <p><strong>Easy to leave</strong><small>Manage your access from account settings.</small></p>
            </div>
          </div>
        </aside>

        <form className="join-card household-join-card panel" onSubmit={submit}>
          <button
            className="household-back-button"
            type="button"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft size={15} /> Back to sign in
          </button>
          <div className="household-join-icon" aria-hidden="true">
            <Users size={20} />
          </div>
          <span className="eyebrow">JOIN A HOUSEHOLD</span>
          <h1>Care works better together.</h1>
          <p className="muted">
            Use the invitation code sent to the email your home admin invited.
            This adds your caregiver or resident account to the household; it does
            not pair a camera.
          </p>

          <div className="household-flow-steps" aria-label="Household join progress">
            <span className="current"><b>1</b> Your details</span>
            <i />
            <span><b>2</b> Invitation</span>
            <i />
            <span><b>3</b> Welcome in</span>
          </div>

          <div className="household-form-fields">
            <label htmlFor="household-name">
              Your name
              <input
                id="household-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                autoFocus
              />
            </label>
            <label htmlFor="household-email">
              Invited email
              <input
                id="household-email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="household-code-field" htmlFor="household-code">
              <span id="household-code-label">Invitation code</span>
              <input
                id="household-code"
                aria-labelledby="household-code-label"
                aria-describedby="household-code-help"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
              />
              <span id="household-code-help">Six digits · one use · shared by the home admin</span>
            </label>
          </div>

          {error && (
            <div className="error-note" role="alert">
              {error}
            </div>
          )}

          <button
            className="primary-button full-width"
            type="submit"
            disabled={busy || code.length !== 6}
          >
            {busy ? "Joining household…" : "Join household"} <ChevronRight size={16} />
          </button>
          <p className="household-privacy-note">
            <ShieldCheck size={15} /> Your invitation only adds this account to
            the household. Camera permissions are a separate choice.
          </p>
        </form>
      </main>
    </div>
  );
}
