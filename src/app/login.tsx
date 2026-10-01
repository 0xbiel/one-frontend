import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, demoMode } from "../api/client";
import "./login.css";
import "./legalLinks.css";

type Step = "email" | "code";

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [localCodeProvided, setLocalCodeProvided] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestCode = async () => {
    if (busy || !email) return;
    setBusy(true);
    setError("");
    try {
      const challenge = await api.requestEmailCode("login", email);
      setCode(challenge.dev_code ?? "");
      setLocalCodeProvided(Boolean(challenge.dev_code));
      setStep("code");
    } catch {
      setError("We couldn't send a sign-in code. Check the email address and try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (step === "email") {
      await requestCode();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await api.verifyEmailCode(email, code);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("That code is invalid or has expired. Request a new one and try again.");
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    setError("");
    try {
      await api.verifyEmailCode("demo@one.local", "482701");
      navigate("/dashboard", { replace: true });
    } catch {
      setError("The demo could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="one-login-page">
    <section className="one-login-form-panel">
      <Link to="/" className="one-login-brand" aria-label="ONE home"><img src="/one-logo.png" alt="" /><span>one</span></Link>
      <div className="one-login-intro">
        <h1>Care,<br />made closer.</h1>
        <p>Sign in to your care space</p>
        <p className="one-login-code-help">We’ll email you a one-time code to sign in.</p>
        {demoMode && <span className="one-login-demo-tag">DEMO MODE · SAMPLE DATA</span>}
      </div>
      <form onSubmit={submit} className="one-login-form">
        {step === "code" && <button className="one-login-back" type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}><ArrowLeft size={16} /> Change email</button>}
        <label htmlFor="one-login-email">Email</label>
        <input id="one-login-email" type="email" autoComplete="email" placeholder="name@example.com" required value={email} onChange={event => setEmail(event.target.value)} disabled={step !== "email"} />
        {step === "code" && <>
          <p className="one-login-code-help">Enter the six-digit code sent to <strong>{email}</strong>. The server checks that it matches an active, unused code for this email.</p>
          {localCodeProvided && <p className="one-login-code-help">Development code filled in for local testing.</p>}
          <label htmlFor="one-login-code">One-time code</label>
          <input id="one-login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button type="button" className="one-login-recover-link" onClick={() => void requestCode()} disabled={busy}>Resend code</button>
        </>}
        {error && <p className="one-login-error" role="alert">{error}</p>}
        <button className="one-login-primary" type="submit" disabled={busy || !email || (step === "code" && code.length !== 6)}>
          {busy ? "Please wait…" : step === "email" ? "Send sign-in code" : "Sign in"}<ArrowRight size={17} />
        </button>
      </form>
      {demoMode && <button type="button" className="one-login-demo-button" onClick={() => void enterDemo()} disabled={busy}>Explore the demo without an account <ArrowRight size={16} /></button>}
      {step === "email" && <div className="one-login-bottom"><strong>New to ONE?</strong><Link to="/create-account">Create a care space</Link></div>}
      {step === "code" && <div className="one-login-bottom"><span>Don't have an account yet?</span><Link to="/create-account">Create a care space</Link></div>}
      <nav className="one-login-legal" aria-label="Legal documents"><a href="/legal/privacy-notice.html#privacy">Privacy notice</a><a href="/legal/privacy-notice.html#terms">Terms of use</a></nav>
    </section>
    <div className="one-login-photo" role="img" aria-label="Two people watching the sunset from home" />
  </main>;
}
