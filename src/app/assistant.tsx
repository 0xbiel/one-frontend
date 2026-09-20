import { useState } from "react";
import { ChevronRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { CareAnalytics, Session } from "../models/domain";
import { api, demoMode } from "../api/client";

export function AssistantPage({ session, analytics }: { session?: Session; analytics?: CareAnalytics }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const actorName = session?.actor.name ?? "Clara García";
  const residentName = session?.home.residentName ?? "María";
  const [messages, setMessages] = useState([{ from: "one", text: `Good morning, ${actorName.split(/\s+/)[0] || "there"}. I can help you understand what ONE observed — gently and with context.` }]);
  const ask = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setMessages((messages) => [...messages, { from: "you", text: q }]);
    setBusy(true);
    try {
      const recipient = sessionStorage.getItem("one_care_recipient_id") || undefined;
      const result = demoMode
        ? { data: { summary: q.toLowerCase().includes("key") ? "The keys were last observed near the entryway console." : `The latest household records include ${analytics?.daily_check_in.completed_today ?? 0} check-in(s) today and ${analytics?.fall.needs_review ?? 0} fall-safety signal(s) needing review.`, next_action: "Review the linked events with the caregiver team.", limitations: "Demo response · observations only; not medical advice." } }
        : await api.askFamilyAssistant(q, undefined, recipient);
      setMessages((messages) => [...messages, { from: "one", text: `${result.data.summary}\n\n${result.data.next_action}\n\n${result.data.limitations}` }]);
    } catch {
      setMessages((messages) => [...messages, { from: "one", text: "The assistant could not reach the bounded household records right now. Review Events and Today’s check-in directly." }]);
    } finally {
      setBusy(false);
    }
  };
  return <div className="assistant-page"><header className="page-heading-clean"><span className="eyebrow">ASSISTANT</span><h2>Household assistant</h2><p>Ask about {residentName}’s observed day, daily check-ins, safety signals, and last-seen objects.</p></header><div className="assistant-layout"><section className="assistant-card panel"><div className="assistant-intro"><span className="assistant-spark"><Sparkles size={20} /></span><div><span className="eyebrow">ONE ASSISTANT</span><h3>Ask about today</h3><p>ONE uses the available household records to ground its answer. Raw frames and face templates never enter this conversation.</p></div></div><div className="chat-log" aria-live="polite">{messages.map((message, index) => <div className={`chat-bubble ${message.from}`} key={`${message.from}-${index}`}>{message.text}{message.from === "one" && index > 0 && <small>Based on household records · Not a diagnosis</small>}</div>)}</div><div className="assistant-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask(); }} placeholder="Try: What changed from yesterday?" aria-label="Ask ONE assistant" disabled={busy} /><button className="primary-button" onClick={() => void ask()} disabled={busy}>{busy ? "Reviewing…" : <><MessageCircle size={16} /> Ask ONE</>}</button></div></section><aside className="suggestion-panel"><span className="eyebrow">SUGGESTED QUESTIONS</span>{["Where were the keys last seen?", "How did the morning check-in go?", "What changed from yesterday?"].map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}<ChevronRight size={15} /></button>)}<div className="assistant-note"><ShieldCheck size={17} /><span>ONE explains observations. It does not diagnose or make emergency decisions.</span></div></aside></div></div>;
}
