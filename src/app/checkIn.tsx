import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CareAnalytics, DailyCheckInResult, HomeEvent, Session } from "../models/domain";
import { EventRow, formatTime } from "./shared";

const prompts = [
  { id: "morning", title: "How are you feeling in this moment?", detail: "Choose the answer that feels closest. There is no right answer.", options: ["Good", "Okay", "Hard to say"] },
  { id: "routine", title: "How did the morning go?", detail: "A simple reflection helps us compare with the person’s own familiar rhythm.", options: ["Familiar", "A little different", "I’m not sure"] },
  { id: "note", title: "Is there anything you want a caregiver to know?", detail: "You can keep it short, or choose that there is nothing to add.", options: ["Nothing to add", "I’d like to share something", "Skip for now"] },
];

const isToday = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

export function CheckInPage({ events, analytics, session, onEvent, onSaved }: { events: HomeEvent[]; analytics?: CareAnalytics; session?: Session; onEvent: (event: HomeEvent) => void; onSaved?: () => void }) {
  const navigate = useNavigate();
  const residentName = session?.home.residentName ?? "Resident";
  const checkInEvent = events.find((event) => event.type === "daily.check_in" && isToday(event.occurredAt)) ?? events.find((event) => event.type === "daily.check_in");
  const recentContext = events.filter((event) => event.id !== checkInEvent?.id).slice(0, 3);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DailyCheckInResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentPrompt = prompts[step];
  const currentAnswer = currentPrompt ? answers[currentPrompt.id] : undefined;
  const completed = Boolean(checkInEvent || result);
  const recordedCopy = result?.explanation ?? checkInEvent?.detail ?? "When the resident completes a check-in, ONE places the result alongside the personal baseline and reviewable household context.";
  const progress = useMemo(() => `${step + 1} of ${prompts.length}`, [step]);

  const start = () => {
    setError("");
    setResult(null);
    setAnswers({});
    setStep(0);
    setStarted(true);
  };

  const continueFlow = async () => {
    if (!currentAnswer || busy) return;
    if (step < prompts.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const transcript = prompts.map((prompt) => `${prompt.title}: ${answers[prompt.id] ?? "Not answered"}`).join("\n");
      const saved = await api.submitDailyCheckIn(transcript);
      setResult(saved);
      setStarted(false);
      onSaved?.();
    } catch {
      setError("We could not record this check-in. The answers stayed on this screen; try again when the connection is available.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="checkin-page">
      <header className="checkin-heading">
        <span className="eyebrow">TODAY</span>
        <h2>Today’s check-in</h2>
        <p>A calm human signal, compared with {residentName}’s own recent rhythm. Start only when the person you’re supporting is ready.</p>
      </header>

      <section className={`checkin-hero ${completed ? "complete" : "pending"}`}>
        <div className="checkin-hero-top">
          <span className="checkin-symbol"><HeartHandshake size={20} /></span>
          <span className="checkin-state"><i /> {completed ? "Recorded today" : "Waiting today"}</span>
        </div>
        <div className="checkin-hero-copy">
          <span className="eyebrow">DAILY CHECK-IN</span>
          <h3>{completed ? "A familiar check-in is recorded." : "No check-in has been recorded yet."}</h3>
          <p>{recordedCopy}</p>
        </div>
        <div className="checkin-hero-meta">
          <span><Clock3 size={15} /> {checkInEvent ? `Recorded ${formatTime(checkInEvent.occurredAt)}` : result ? "Just recorded" : "Not recorded yet"}</span>
          <span><ShieldCheck size={15} /> Observation, not diagnosis</span>
        </div>
      </section>

      <div className="checkin-grid">
        <section className="panel checkin-flow-card">
          <div className="checkin-section-heading">
            <div><span className="eyebrow">{started ? `PROMPT ${progress}` : "HOW IT READS"}</span><h3>{started ? currentPrompt.title : "One signal, with context."}</h3></div>
            {completed && !started && <CheckCircle2 size={22} className="checkin-complete-icon" />}
          </div>
          {started ? (
            <div className="checkin-runner">
              <p className="checkin-prompt-detail">{currentPrompt.detail}</p>
              <div className="checkin-answer-list" role="radiogroup" aria-label={currentPrompt.title}>
                {currentPrompt.options.map((option) => <button key={option} type="button" className={currentAnswer === option ? "selected" : ""} role="radio" aria-checked={currentAnswer === option} onClick={() => setAnswers((value) => ({ ...value, [currentPrompt.id]: option }))}>{option}</button>)}
              </div>
              {error && <div className="error-note" role="alert">{error}</div>}
              <div className="checkin-runner-actions">
                <button className="secondary-button" type="button" onClick={() => step === 0 ? setStarted(false) : setStep((value) => value - 1)}><ArrowLeft size={15} /> Back</button>
                <button className="primary-button" type="button" disabled={!currentAnswer || busy} onClick={() => void continueFlow()}>{busy ? "Recording…" : step === prompts.length - 1 ? "Record check-in" : "Continue"} {step < prompts.length - 1 && <ArrowRight size={15} />}</button>
              </div>
              <p className="checkin-privacy-note"><ShieldCheck size={14} /> Only the bounded answer summary is kept for caregiver context; no raw audio is stored by this flow.</p>
            </div>
          ) : (
            <>
              <div className="checkin-flow">
                <div className={completed ? "done" : "current"}><span>1</span><div><strong>Familiar prompt</strong><small>A short daily check-in keeps the interaction predictable.</small></div></div>
                <i />
                <div className={completed ? "done" : "upcoming"}><span>2</span><div><strong>Human response</strong><small>The response is recorded as a signal, without turning it into a diagnosis.</small></div></div>
                <i />
                <div className={completed ? "done" : "upcoming"}><span>3</span><div><strong>Personal baseline</strong><small>Caregivers review changes against the resident’s own recent pattern.</small></div></div>
              </div>
              <div className="checkin-start-row"><button className="primary-button" onClick={start}><HeartHandshake size={16} /> {completed ? "Run check-in again" : "Start check-in"} <ArrowRight size={15} /></button><span>Three short prompts · you can go back</span></div>
              {result && <div className="checkin-result" role="status"><span className="eyebrow">RECORDED RESULT · {result.status.toUpperCase()}</span><strong>{result.trend === "unknown" ? "Keep the context human." : `Trend: ${result.trend}`}</strong><p>{result.explanation}</p><small>{result.limitations}</small></div>}
            </>
          )}
          <button className="primary-button checkin-assistant-button" onClick={() => navigate("/dashboard/assistant")}><Sparkles size={16} /> Explore with ONE <ArrowRight size={15} /></button>
        </section>

        <aside className="checkin-context-column">
          <section className="panel checkin-context-card">
            <span className="eyebrow">TODAY’S CONTEXT</span>
            <h3>Recent household signals</h3>
            <p className="muted">These observations stay separate from the check-in. They are here only to help a caregiver review the day in context.</p>
            <div className="checkin-events">
              {recentContext.length ? recentContext.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />) : <div className="checkin-empty-context">No other household observations yet.</div>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
