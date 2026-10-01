import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, demoMode } from "../api/client";
import "./login.css";
import "./legalLinks.css";
import { RegisterPresentation } from "./registerPresentation";

function RealRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [homeName, setHomeName] = useState("");
  const [careSetting, setCareSetting] = useState<"home" | "residence">("home");
  const [code, setCode] = useState("");
  const [localCodeProvided, setLocalCodeProvided] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestCode = async () => {
    const result = await api.requestEmailCode("create", email, name, homeName, careSetting, "general");
    setCode(result.dev_code ?? "");
    setLocalCodeProvided(Boolean(result.dev_code));
    setChallenge(true);
  };

  const resendCode = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await requestCode();
    } catch {
      setError("We couldn't resend the code. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (demoMode) {
        await api.verifyEmailCode("demo@one.local", "482701");
        navigate("/dashboard", { replace: true });
      } else if (!challenge) {
        await requestCode();
      } else {
        await api.verifyEmailCode(email, code);
        navigate("/onboarding", { replace: true });
      }
    } catch {
      setError(challenge ? "That code could not be verified. Check it and try again." : "We couldn't start your account setup. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="one-login-page one-register-page">
    <section className="one-login-form-panel">
      <Link to="/" className="one-login-brand" aria-label="ONE home"><img src="/one-logo.png" alt="" /><span>one</span></Link>
      <div className="one-login-intro">
        <h1>Your care<br />space.</h1>
        <p>{demoMode ? "Explore the sample care space" : "Create your ONE account"}</p>
        {!demoMode && <span className="one-login-code-help">Sign-in uses a one-time email code. No password is needed.</span>}
      </div>
      <form className="one-login-form one-register-form" onSubmit={submit}>
        {!challenge ? <>
          <label htmlFor="register-name">Your name</label>
          <input id="register-name" required autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Full name" />
          <label htmlFor="register-email">Email</label>
          <input id="register-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" />
          <label htmlFor="register-home">Care space name</label>
          <input id="register-home" value={homeName} onChange={event => setHomeName(event.target.value)} placeholder="ONE Home" />
          <label htmlFor="register-setting">Care setting</label>
          <select id="register-setting" value={careSetting} onChange={event => setCareSetting(event.target.value as "home" | "residence")}>
            <option value="home">Private home</option>
            <option value="residence">Residence</option>
          </select>
        </> : <>
          <button className="one-login-back" type="button" onClick={() => { setChallenge(false); setCode(""); setLocalCodeProvided(false); setError(""); }}><ArrowLeft size={16} /> Change details</button>
          <p className="one-login-code-help">Enter the six-digit code for <strong>{email}</strong>.</p>
          {localCodeProvided && <p className="one-login-code-help">Development code filled in for local testing.</p>}
          <label htmlFor="register-code">One-time code</label>
          <input id="register-code" required maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
          <button type="button" className="one-login-recover-link" disabled={busy} onClick={() => void resendCode()}>{busy ? "Sending…" : "Resend code"}</button>
        </>}
        {error && <p className="one-login-error" role="alert">{error}</p>}
        <button className="one-login-primary" type="submit" disabled={busy || (challenge && code.length !== 6)}>
          {busy ? "Please wait…" : demoMode ? "Explore the demo" : challenge ? "Verify email and continue" : "Send verification code"}<ArrowRight size={18} />
        </button>
      </form>
      <div className="one-login-bottom"><strong>Already have an account?</strong><Link to="/login">Sign in</Link></div>
      <nav className="one-login-legal" aria-label="Legal documents"><a href="/legal/privacy-notice.html#privacy">Privacy notice</a><a href="/legal/privacy-notice.html#terms">Terms of use</a></nav>
    </section>
    <div className="one-login-photo" role="img" aria-label="Two people watching the sunset from home" />
  </main>;
}

export function RegisterPage() {
  return demoMode ? <RegisterPresentation /> : <RealRegister />;
}
