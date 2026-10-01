import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { api, demoMode } from "../api/client";
import type { Session } from "../models/domain";

type Message = { from: "one" | "you"; text: string };
const suggestions = ["Hello", "Where is my family at?", "How are they today?", "Where are the keys?", "What questions were asked this week?"];

export function AssistantPage({ session }: { session?: Session }) {
  const [question, setQuestion] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ from: "one", text: "Hello. I can help you review household activity, check-ins and objects." }]);
  const chatLog = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const recipientId = sessionStorage.getItem("one_care_recipient_id") || "";
  const events = useQuery({ queryKey: ["events", "assistant", recipientId], queryFn: () => api.getEvents(recipientId), enabled: demoMode || Boolean(session), retry: false });
  const objects = useQuery({ queryKey: ["objects", session?.home.id, recipientId], queryFn: () => api.getObjects(recipientId || null), enabled: demoMode || Boolean(session), retry: false });
  const checkins = useQuery({ queryKey: ["check-in-questions", recipientId], queryFn: () => api.getCheckInQuestions(recipientId || null), enabled: demoMode || Boolean(session), retry: false });
  const recipients = useQuery({ queryKey: ["care-recipients", session?.home.id], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(session), retry: false });
  const residentName = recipients.data?.find((person) => person.id === recipientId)?.display_name ?? session?.home.residentName ?? "the care recipient";
  const sortedQuestions = useMemo(() => [...(checkins.data ?? [])].sort((a, b) => b.askedAt.localeCompare(a.askedAt)), [checkins.data]);

  useEffect(() => {
    const element = chatLog.current;
    if (!element) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    element.scrollTo({ top: element.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages, typing]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const answerFor = (text: string): string => {
    const lower = text.toLocaleLowerCase("en");
    const allEvents = events.data ?? [];
    const personEvents = allEvents.filter((event) => event.careRecipientId === recipientId);
    const latestPersonLocation = personEvents.find((event) => event.eventType === "person_observed" && event.roomName);
    const today = new Date().toDateString();
    const todaysQuestions = sortedQuestions.filter((item) => new Date(item.askedAt).toDateString() === today);
    const lastQuestion = sortedQuestions[0];
    const repeatedToday = todaysQuestions.filter((item) => item.isRepeat).length;
    const avgToday = todaysQuestions.length ? Math.round(todaysQuestions.reduce((sum, item) => sum + (item.responseTimeMs ?? 0), 0) / todaysQuestions.length / 1000) : null;

    if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(lower.trim())) {
      return `Hello. I’m here to help you look through ${residentName}’s recent check-ins and household activity. What would you like to know?`;
    }
    if (/where.*(family|everyone|they|clara|elena|manuel)|family.*where/.test(lower)) {
      if (latestPersonLocation) return `${residentName} was last observed in the ${latestPersonLocation.roomName} at ${new Date(latestPersonLocation.occurredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. ONE does not have live family location sharing, so this is the latest household observation.`;
      return `I don’t have a recent room observation for ${residentName}. Live family location sharing is not connected.`;
    }
    if (/how.*(today|they|he|she|manuel|maria)|today.*(going|status)/.test(lower)) {
      if (!todaysQuestions.length) {
        const latestEvent = personEvents[0];
        return latestEvent ? `There is no check-in recorded today. The latest household signal for ${residentName} is “${latestEvent.title}”: ${latestEvent.detail}` : `There is no check-in or recent household signal recorded for ${residentName} today.`;
      }
      const promptCount = todaysQuestions.length;
      return `${residentName} has answered ${promptCount - repeatedToday} familiar prompts today${repeatedToday ? ` and asked ${repeatedToday} follow-up ${repeatedToday === 1 ? "question" : "questions"}` : ""}. Average time to respond was ${avgToday} seconds${lastQuestion ? `; the latest prompt was “${lastQuestion.question}”` : ""}. These are care observations, not a diagnosis.`;
    }
    if (/where.*(manuel|maria|person|he|she)|location of/.test(lower)) {
      return latestPersonLocation ? `${residentName} was last observed in the ${latestPersonLocation.roomName}. That observation was at ${new Date(latestPersonLocation.occurredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}; it is not live tracking.` : `There is no recent room observation for ${residentName}.`;
    }
    if (/key|glasses|medication|object|where/.test(lower)) {
      const rows = objects.data ?? [];
      const match = rows.find((item) => lower.includes(item.label.toLocaleLowerCase("en"))) ?? rows[0];
      return match ? `${match.label} was last seen near ${match.zone?.name ?? "an unknown room"} at ${match.lastSeenAt ? new Date(match.lastSeenAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "an unknown time"}. The location is approximate.` : "I don’t have a recent object observation to show.";
    }
    if (/question|answer|check.?in|pulse|heart rate|response time|repeat/.test(lower)) {
      if (!sortedQuestions.length) return "There are no recorded check-in answers to review yet.";
      const week = sortedQuestions.filter((item) => Date.now() - new Date(item.askedAt).getTime() <= 7 * 86_400_000);
      const repeats = week.filter((item) => item.isRepeat).length;
      if (/week|recent/.test(lower)) return `In the last week, ${residentName} answered ${week.length - repeats} check-in prompts${repeats ? ` and asked to repeat ${repeats} ${repeats === 1 ? "prompt" : "prompts"}` : ""}. The answers remain available in Questions & Signals.`;
      const item = sortedQuestions[0];
      return `The latest prompt for ${residentName} was “${item.question}”. The answer was “${item.answer || "not recorded"}”; response time was ${item.responseTimeMs === null ? "not recorded" : `${Math.round(item.responseTimeMs / 1000)} seconds`}.`;
    }
    const latest = allEvents[0];
    return latest ? `The most recent household observation is “${latest.title}”: ${latest.detail}${latest.roomName ? ` It was recorded near the ${latest.roomName}.` : ""}` : "I don’t have a recent household observation to summarize yet.";
  };

  const send = (content = question) => {
    const text = content.trim();
    if (!text || typing) return;
    const response = answerFor(text);
    setMessages((current) => [...current, { from: "you", text }]);
    setQuestion("");
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setMessages((current) => [...current, { from: "one", text: response }]);
      setTyping(false);
      timer.current = null;
    }, 850);
  };

  const submit = (event: FormEvent) => { event.preventDefault(); send(); };
  return <div className="assistant-page"><header className="page-heading-clean"><span className="eyebrow">ASSISTANT</span><h2>Household assistant</h2><p>Ask about recent household activity, check-ins, family and objects.</p></header><div className="assistant-layout"><section className="assistant-card panel"><div className="assistant-intro"><span className="assistant-spark"><Sparkles size={20} /></span><div><span className="eyebrow">ONE ASSISTANT</span><h3>Review the day</h3><p>Answers are based on information available in this care space.</p></div></div><div className="chat-log" ref={chatLog} aria-live="polite">{messages.map((message, index) => <div className={`chat-bubble ${message.from}`} key={`${message.from}-${index}`}>{message.text}</div>)}{typing && <div className="chat-bubble one assistant-typing" aria-label="ONE is typing"><i /><i /><i /></div>}<div className="assistant-chat-end" /></div><form className="assistant-input" onSubmit={submit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about today’s care" aria-label="Ask the ONE assistant" /><button className="primary-button" type="submit" disabled={!question.trim() || typing}><MessageCircle size={16} /> Ask</button></form></section><aside className="suggestion-panel"><span className="eyebrow">SUGGESTED QUESTIONS</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)} disabled={typing}>{suggestion}<ChevronRight size={15} /></button>)}<div className="assistant-note"><ShieldCheck size={17} /><span>ONE shares recorded observations to help caregivers review routines. It does not diagnose or make emergency decisions.</span></div></aside></div></div>;
}
