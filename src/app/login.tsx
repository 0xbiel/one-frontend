import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, demoMode } from "../api/client";
import "./login.css";

type Step = "email" | "password" | "recover";

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (step === "email") { setStep("password"); return; }
    if (busy) return;
    setBusy(true);
    try {
      if (step === "password") await api.loginPassword(email, password);
      else await api.resetPassword(email, code, nextPassword);
      navigate("/dashboard", { replace: true });
    } catch {
      setError(step === "password" ? "El correo o la contraseña no son correctos." : "El código no es válido o ha caducado.");
    } finally { setBusy(false); }
  };

  const recover = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const challenge = await api.requestEmailCode("login", email);
      if (challenge.dev_code) setCode(challenge.dev_code);
      setStep("recover");
    } catch { setError("No hemos podido enviar el código. Revisa el correo e inténtalo de nuevo."); }
    finally { setBusy(false); }
  };

  const enterDemo = async () => {
    setBusy(true); setError("");
    try { await api.loginPassword("demo@one.local", "demo"); navigate("/dashboard", { replace: true }); }
    catch { setError("No se pudo abrir la demostración."); }
    finally { setBusy(false); }
  };

  return <main className="one-login-page">
    <section className="one-login-form-panel">
      <Link to="/" className="one-login-brand" aria-label="ONE, inicio"><img src="/one-logo.png" alt="" /><span>one</span></Link>
      <div className="one-login-intro"><h1>Care,<br />made closer.</h1><p>Sign in to your care space</p>{demoMode && <span className="one-login-demo-tag">MODO DEMO · DATOS DE EJEMPLO</span>}</div>
      <form onSubmit={submit} className="one-login-form">
        {step !== "email" && <button className="one-login-back" type="button" onClick={() => { setStep("email"); setError(""); }}><ArrowLeft size={16} /> Cambiar correo</button>}
        <label htmlFor="one-login-email">Email</label><input id="one-login-email" type="email" autoComplete="email" placeholder="Your email..." required value={email} onChange={event => setEmail(event.target.value)} disabled={step !== "email"} />
        {step === "password" && <><label htmlFor="one-login-password">Password</label><input id="one-login-password" type="password" autoComplete="current-password" placeholder="Password" required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" className="one-login-recover-link" onClick={() => void recover()}>¿No tienes contraseña o la has olvidado?</button></>}
        {step === "recover" && <><p className="one-login-code-help">Introduce el código enviado a tu correo y crea una contraseña de al menos 12 caracteres.</p><label htmlFor="one-login-code">Código de correo</label><input id="one-login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /><label htmlFor="one-login-new-password">Nueva contraseña</label><input id="one-login-new-password" type="password" autoComplete="new-password" minLength={12} placeholder="Al menos 12 caracteres" required value={nextPassword} onChange={event => setNextPassword(event.target.value)} /></>}
        {error && <p className="one-login-error" role="alert">{error}</p>}
        <button className="one-login-primary" type="submit" disabled={busy || !email || (step === "password" && !password) || (step === "recover" && (code.length !== 6 || nextPassword.length < 12))}>{busy ? "Un momento..." : step === "email" ? "Continue with your email" : step === "password" ? "Log In" : "Crear contraseña y entrar"}{step === "recover" && <ArrowRight size={17} />}</button>
      </form>
      {demoMode && <button type="button" className="one-login-demo-button" onClick={() => void enterDemo()} disabled={busy}>Entrar sin cuenta y explorar el panel <ArrowRight size={16} /></button>}
      {step === "email" && <div className="one-login-bottom"><strong>New to ONE?</strong><Link to="/create-account">Create a care space</Link></div>}
      {step === "password" && <div className="one-login-bottom"><span>¿Todavía no tienes una cuenta?</span><Link to="/create-account">Crear espacio</Link></div>}
    </section>
    <div className="one-login-photo" role="img" aria-label="Dos personas contemplan el atardecer desde su hogar" />
  </main>;
}
