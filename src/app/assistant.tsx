import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api/client";
import type { Session } from "../models/domain";

export function AssistantPage({ session }: { session?: Session }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ from: "one" | "you"; text: string }>>([{ from: "one", text: "Hello. I can help you review information ONE has received from your home." }]);
  const events = useQuery({ queryKey: ["events"], queryFn: api.getEvents, retry: false });
  const objects = useQuery({ queryKey: ["objects"], queryFn: api.getObjects, retry: false });
  const checkins = useQuery({ queryKey: ["check-in-questions"], queryFn: api.getCheckInQuestions, retry: false });
  const residentName = session?.home.residentName ?? "the care recipient";

  const ask = () => {
    const text = question.trim();
    if (!text) return;
    const lower = text.toLocaleLowerCase("en");
    let reply: string;
    if (/key|glasses|object|where/.test(lower)) {
      const match = (objects.data ?? []).find((item) => lower.includes(item.label.toLocaleLowerCase("en"))) ?? (objects.data ?? [])[0];
      reply = match ? `${match.label}: ${match.zone?.name ?? "room unknown"}. Last observed: ${match.lastSeenAt ? new Date(match.lastSeenAt).toLocaleString("en-US") : "time unavailable"}. Location is approximate.` : "I have not received an object observation to show yet.";
    } else if (/question|answer|check.?in|pulse|heart rate|time/.test(lower)) {
      const last = (checkins.data ?? [])[0];
      reply = last ? `Most recent question for ${residentName}: “${last.question}”. Answer: ${last.answer || "not recorded"}. ${last.responseTimeMs === null ? "Voice start time is unavailable." : `Time to start speaking: ${Math.round(last.responseTimeMs / 1000)} seconds.`}` : "There are no recorded questions yet. You can start a daily check-in from the dashboard.";
    } else {
      const last = (events.data ?? [])[0];
      reply = last ? `The most recent observation was “${last.title}” (${new Date(last.occurredAt).toLocaleString("en-US")}). ${last.cameraName ? `Source: ${last.cameraName}. ` : ""}${last.detail}` : "There are no events from cameras or the Hub yet. I can’t describe activity the system has not observed.";
    }
    setMessages((current) => [...current, { from: "you", text }, { from: "one", text: `${reply} These signals need human interpretation and are not a diagnosis.` }]);
    setQuestion("");
  };

  return <div className="assistant-page"><header className="page-heading-clean"><span className="eyebrow">ASSISTANT</span><h2>Household assistant</h2><p>Ask about recorded events, objects, or check-ins. Answers are based on information received by ONE.</p></header><div className="assistant-layout"><section className="assistant-card panel"><div className="assistant-intro"><span className="assistant-spark"><Sparkles size={20} /></span><div><span className="eyebrow">ONE ASSISTANT</span><h3>Review the day</h3><p>If home data has not arrived yet, I’ll tell you.</p></div></div><div className="chat-log" aria-live="polite">{messages.map((message, index) => <div className={`chat-bubble ${message.from}`} key={`${message.from}-${index}`}>{message.text}</div>)}</div><div className="assistant-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder="What questions were asked today?" aria-label="Ask the ONE assistant" /><button className="primary-button" onClick={ask} disabled={!question.trim()}><MessageCircle size={16} /> Ask</button></div></section><aside className="suggestion-panel"><span className="eyebrow">SUGGESTED QUESTIONS</span>{["What questions were asked?", "Where are the keys?", "What was the latest event?"].map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}<ChevronRight size={15} /></button>)}<div className="assistant-note"><ShieldCheck size={17} /><span>ONE shows recorded observations. It does not diagnose or make emergency decisions.</span></div></aside></div></div>;
}
