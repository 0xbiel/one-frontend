import { useState } from "react";
import { ChevronRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

export function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([{ from: "one", text: "Good morning, Clara. I can help you understand what ONE observed — gently and with context." }]);
  const ask = () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setMessages((messages) => [...messages, { from: "you", text: q }, { from: "one", text: q.toLowerCase().includes("key") ? "The keys were last observed 18 minutes ago near the entryway console. The estimate has a confidence radius of 0.8m." : "I found a calm morning check-in and no urgent changes from María’s personal baseline. Would you like to explore a specific moment?" }]);
  };
  return <div className="assistant-layout"><section className="assistant-card panel"><div className="assistant-intro"><span className="assistant-spark"><Sparkles size={20} /></span><div><span className="eyebrow">ONE ASSISTANT</span><h2>Context, not conclusions.</h2><p>Ask about observations and moments from María’s day. Answers always link back to evidence.</p></div></div><div className="chat-log" aria-live="polite">{messages.map((message, index) => <div className={`chat-bubble ${message.from}`} key={`${message.from}-${index}`}>{message.text}{message.from === "one" && index > 0 && <small>Based on observed events · Not a diagnosis</small>}</div>)}</div><div className="assistant-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder="Try: Where were the keys last seen?" aria-label="Ask ONE assistant" /><button className="primary-button" onClick={ask}><MessageCircle size={16} /> Ask ONE</button></div></section><aside className="suggestion-panel"><span className="eyebrow">TRY ASKING</span>{["Where were the keys last seen?", "How did the morning check-in go?", "What changed from yesterday?"].map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}<ChevronRight size={15} /></button>)}<div className="assistant-note"><ShieldCheck size={17} /><span>ONE explains observations. It does not diagnose or make emergency decisions.</span></div></aside></div>;
}
