import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api/client";
import type { Session } from "../models/domain";

export function AssistantPage({ session }: { session?: Session }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ from: "one" | "you"; text: string }>>([{ from: "one", text: "Hola. Puedo ayudarte a revisar los datos que ONE ha recibido del hogar." }]);
  const events = useQuery({ queryKey: ["events"], queryFn: api.getEvents, retry: false });
  const objects = useQuery({ queryKey: ["objects"], queryFn: api.getObjects, retry: false });
  const checkins = useQuery({ queryKey: ["check-in-questions"], queryFn: api.getCheckInQuestions, retry: false });
  const residentName = session?.home.residentName ?? "la persona cuidada";

  const ask = () => {
    const text = question.trim();
    if (!text) return;
    const lower = text.toLocaleLowerCase("es");
    let reply: string;
    if (/llave|gafa|objeto|dónde|donde/.test(lower)) {
      const match = (objects.data ?? []).find((item) => lower.includes(item.label.toLocaleLowerCase("es"))) ?? (objects.data ?? [])[0];
      reply = match ? `${match.label}: ${match.zone?.name ?? "estancia no determinada"}. Última observación: ${match.lastSeenAt ? new Date(match.lastSeenAt).toLocaleString("es-ES") : "sin hora disponible"}. La ubicación es aproximada.` : "Aún no he recibido una observación de objetos que pueda mostrarte.";
    } else if (/pregunta|respuesta|check|pulso|tiempo/.test(lower)) {
      const last = (checkins.data ?? [])[0];
      reply = last ? `Última pregunta registrada para ${residentName}: «${last.question}». Respuesta: ${last.answer || "no registrada"}. ${last.responseTimeMs === null ? "El tiempo de inicio de voz no está disponible." : `Tiempo hasta empezar a hablar: ${Math.round(last.responseTimeMs / 1000)} segundos.`}` : "Todavía no hay preguntas registradas. Puedes iniciar una conversación diaria desde el panel.";
    } else {
      const last = (events.data ?? [])[0];
      reply = last ? `La observación más reciente fue «${last.title}» (${new Date(last.occurredAt).toLocaleString("es-ES")}). ${last.cameraName ? `Origen: ${last.cameraName}. ` : ""}${last.detail}` : "Todavía no hay eventos recibidos de cámaras o del Hub. No puedo describir actividad que el sistema no haya observado.";
    }
    setMessages((current) => [...current, { from: "you", text }, { from: "one", text: `${reply} Estas señales requieren interpretación humana y no son un diagnóstico.` }]);
    setQuestion("");
  };

  return <div className="assistant-page"><header className="page-heading-clean"><span className="eyebrow">ASSISTANT</span><h2>Household assistant</h2><p>Pregunta por eventos, objetos o check-ins registrados. Las respuestas se basan en datos recibidos por ONE.</p></header><div className="assistant-layout"><section className="assistant-card panel"><div className="assistant-intro"><span className="assistant-spark"><Sparkles size={20} /></span><div><span className="eyebrow">ONE ASSISTANT</span><h3>Revisa el día</h3><p>Si todavía no han llegado datos del hogar, te lo diré claramente.</p></div></div><div className="chat-log" aria-live="polite">{messages.map((message, index) => <div className={`chat-bubble ${message.from}`} key={`${message.from}-${index}`}>{message.text}</div>)}</div><div className="assistant-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder="¿Qué preguntas se hicieron hoy?" aria-label="Pregunta al asistente ONE" /><button className="primary-button" onClick={ask}><MessageCircle size={16} /> Preguntar</button></div></section><aside className="suggestion-panel"><span className="eyebrow">PREGUNTAS SUGERIDAS</span>{["¿Qué preguntas se hicieron?", "¿Dónde están las llaves?", "¿Cuál fue el último evento?"].map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}<ChevronRight size={15} /></button>)}<div className="assistant-note"><ShieldCheck size={17} /><span>ONE muestra observaciones registradas. No diagnostica ni toma decisiones de emergencia.</span></div></aside></div></div>;
}
