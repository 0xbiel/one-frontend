import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, demoMode } from "../api/client";
import "./login.css";
import { RegisterPresentation } from "./registerPresentation";

function RealRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [homeName, setHomeName] = useState("");
  const [careSetting, setCareSetting] = useState<"home" | "residence">("home");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      if (demoMode) {
        await api.loginPassword(email, "demo");
        navigate("/dashboard", { replace: true });
      } else if (!challenge) {
        const result = await api.requestEmailCode("create", email, name, homeName, careSetting, "general");
        setCode(result.dev_code ?? "");
        setChallenge(true);
      } else {
        if (!verified) { await api.verifyEmailCode(email, code); setVerified(true); }
        await api.setPassword(password);
        navigate("/onboarding", { replace: true });
      }
    } catch { setError(challenge ? "No se pudo verificar el código o guardar la contraseña." : "No se pudo crear la cuenta. Comprueba los datos."); }
    finally { setBusy(false); }
  };

  return <main className="one-login-page one-register-page"><section className="one-login-form-panel"><Link to="/" className="one-login-brand" aria-label="ONE, inicio"><img src="/one-logo.png" alt="" /><span>one</span></Link><div className="one-login-intro"><h1>Tu espacio<br />de cuidado.</h1><p>{demoMode ? "Prueba el registro y entra al panel de demostración" : "Crea tu cuenta ONE"}</p></div><form className="one-login-form one-register-form" onSubmit={submit}>
    {!challenge ? <><label htmlFor="register-name">Tu nombre</label><input id="register-name" required autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre y apellidos" /><label htmlFor="register-email">Email</label><input id="register-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Tu correo" /><label htmlFor="register-home">Nombre del hogar o residencia</label><input id="register-home" value={homeName} onChange={event => setHomeName(event.target.value)} placeholder="ONE Home" /><label htmlFor="register-setting">Tipo de espacio</label><select id="register-setting" value={careSetting} onChange={event => setCareSetting(event.target.value as "home" | "residence")}><option value="home">Hogar</option><option value="residence">Residencia</option></select>{!demoMode && <><label htmlFor="register-password">Contraseña</label><input id="register-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Al menos 12 caracteres" /></>}</> : <><p className="one-login-code-help">Hemos enviado un código de seis cifras a <strong>{email}</strong>. Introdúcelo para verificar tu cuenta.</p><label htmlFor="register-code">Código de correo</label><input id="register-code" required maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} placeholder="123456" /></>}
    {error && <p className="one-login-error" role="alert">{error}</p>}<button className="one-login-primary" type="submit" disabled={busy || (challenge && code.length !== 6)}>{busy ? "Un momento..." : demoMode ? "Entrar al panel de demostración" : challenge ? "Verificar y continuar" : "Crear espacio de cuidado"}<ArrowRight size={18} /></button></form><div className="one-login-bottom"><strong>¿Ya tienes cuenta?</strong><Link to="/login">Iniciar sesión</Link></div></section><div className="one-login-photo" role="img" aria-label="Dos personas contemplan el atardecer desde su hogar" /></main>;
}

export function RegisterPage() { return demoMode ? <RegisterPresentation /> : <RealRegister />; }


