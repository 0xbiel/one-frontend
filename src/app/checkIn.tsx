import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QuestionSignalChart } from "./QuestionSignalChart";
import { api, demoMode } from "../api/client";
import type { CareAnalytics, DailyCheckInResult, HomeEvent, Session } from "../models/domain";
import { EventRow, formatTime } from "./shared";

const prompts = [
  { id: "morning", title: "How are you feeling in this moment?", detail: "Choose the answer that feels closest. There is no right answer.", options: ["Good", "Okay", "Hard to say"] },
  { id: "routine", title: "How did the morning go?", detail: "A simple reflection helps us compare with the person’s own familiar rhythm.", options: ["Familiar", "A little different", "I’m not sure"] },
  { id: "note", title: "Is there anything you want a caregiver to know?", detail: "You can keep it short, or choose that there is nothing to add.", options: ["Nothing to add", "I’d like to share something", "Skip for now"] },
];

export function CheckInPage({ events, session, onEvent, onSaved, recipientId }: { recipientId: string; events: HomeEvent[]; analytics?: CareAnalytics; session?: Session; onEvent: (event: HomeEvent) => void; onSaved?: () => void }) {
  const navigate = useNavigate();
  const summariesQuery = useQuery({ queryKey: ["caregiver-summaries", session?.home.id, recipientId], queryFn: () => api.getCaregiverSummaries(recipientId || null), enabled: demoMode || Boolean(session), retry: false });
  const questionsQuery = useQuery({ queryKey: ["check-in-questions", recipientId], queryFn: () => api.getCheckInQuestions(recipientId || null), enabled: demoMode || Boolean(session), retry: false });
  const today = new Date().toDateString();
  const todaySummary = summariesQuery.data?.find((item) => item.careRecipientId === recipientId && new Date(item.createdAt).toDateString() === today);
  const recipientsQuery = useQuery({ queryKey: ["care-recipients", session?.home.id], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(session), retry: false });
  const residentName = recipientsQuery.data?.find((person) => person.id === recipientId)?.display_name ?? session?.home.residentName ?? "Resident";
  const checkInEvent = events.find((event) => event.careRecipientId === recipientId && (event.eventType === "daily_check_in" || /check[- ]?in/i.test(event.title)) && new Date(event.occurredAt).toDateString() === today);
  const recentContext = events.filter((event) => event.id !== checkInEvent?.id).slice(0, 3);
  const [selectedDay, setSelectedDay] = useState(6);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const recorded = Boolean(summariesQuery.data?.some((item) => item.careRecipientId === recipientId && new Date(item.createdAt).toDateString() === date.toDateString())
      || events.some((event) => event.careRecipientId === recipientId && event.eventType === "daily_check_in" && new Date(event.occurredAt).toDateString() === date.toDateString()));
    return { label: new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric" }).format(date), recorded };
  });

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DailyCheckInResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentPrompt = prompts[step];
  const currentAnswer = currentPrompt ? answers[currentPrompt.id] : undefined;
  const completed = Boolean(checkInEvent || todaySummary || result);
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
      const saved = await api.submitDailyCheckIn({ careRecipientId: recipientId || null, questions: prompts.map((prompt) => ({ question: prompt.title, answer: answers[prompt.id] ?? "Not answered", responseTimeMs: null, baselineMs: null, pulseBpm: null })) });
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

      <section className={`panel checkin-main-card ${completed ? "is-complete" : "is-pending"} ${started ? "is-running" : ""}`}>
        <div className="checkin-card-head">
          <div className="checkin-card-identity">
            <span className="checkin-symbol"><HeartHandshake size={20} /></span>
            <div>
              <span className="eyebrow">DAILY CHECK-IN</span>
              <strong>{residentName}</strong>
            </div>
          </div>
          <span className="checkin-state"><i /> {completed ? "Recorded today" : started ? `Prompt ${progress}` : "Ready when they are"}</span>
        </div>

        <div className="checkin-card-copy">
          <h3>{started ? currentPrompt.title : completed ? "A familiar check-in is recorded." : "A small moment to understand today."}</h3>
          <p>{started ? currentPrompt.detail : completed ? recordedCopy : `Three short prompts for ${residentName}, then ONE keeps the answer in context with their own recent rhythm.`}</p>
        </div>

        {started ? (
          <div className="checkin-session">
            <div className="checkin-progress-row" aria-label={`Check-in progress: ${progress}`}>
              <span>Question {progress}</span>
              <div className="checkin-progress-track" aria-hidden="true"><span style={{ width: `${((step + 1) / prompts.length) * 100}%` }} /></div>
            </div>
            <div className="checkin-answer-list" role="radiogroup" aria-label={currentPrompt.title}>
              {currentPrompt.options.map((option) => (
                <button key={option} type="button" className={currentAnswer === option ? "selected" : ""} role="radio" aria-checked={currentAnswer === option} onClick={() => setAnswers((value) => ({ ...value, [currentPrompt.id]: option }))}>
                  <span>{option}</span>
                  <span className="checkin-answer-mark" aria-hidden="true">{currentAnswer === option && <CheckCircle2 size={19} />}</span>
                </button>
              ))}
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
            <div className="checkin-flow checkin-flow-preview">
              <div className={completed ? "done" : "current"}><span>{completed ? <CheckCircle2 size={16} /> : "1"}</span><div><strong>Ask</strong><small>Three familiar, low-pressure prompts.</small></div></div>
              <i />
              <div className={completed ? "done" : "upcoming"}><span>{completed ? <CheckCircle2 size={16} /> : "2"}</span><div><strong>Record</strong><small>Keep the person’s answer as a human signal.</small></div></div>
              <i />
              <div className={completed ? "done" : "upcoming"}><span>{completed ? <CheckCircle2 size={16} /> : "3"}</span><div><strong>Review</strong><small>Compare with their own recent pattern.</small></div></div>
            </div>

            {result && <div className="checkin-result" role="status"><span className="eyebrow">RECORDED RESULT · {result.status.toUpperCase()}</span><strong>{result.trend === "unknown" ? "Keep the context human." : `Trend: ${result.trend}`}</strong><p>{result.explanation}</p><small>{result.limitations}</small></div>}

            <div className="checkin-card-footer">
              <div className="checkin-card-meta">
                <span><Clock3 size={15} /> {checkInEvent ? `Recorded ${formatTime(checkInEvent.occurredAt)}` : result ? "Just recorded" : "About two minutes"}</span>
                <span><ShieldCheck size={15} /> Observation, not diagnosis</span>
              </div>
              <div className="checkin-card-actions">
                <button className="secondary-button" onClick={() => navigate("/dashboard/assistant")}><Sparkles size={16} /> Ask ONE</button>
                <button className="primary-button" onClick={start}><HeartHandshake size={16} /> {completed ? "Check in again" : "Start check-in"} <ArrowRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="panel checkin-context-card checkin-context-wide">
        <div className="checkin-context-heading">
          <div><span className="eyebrow">TODAY’S CONTEXT</span><h3>Recent household signals</h3></div>
          <p className="muted">Kept separate from the check-in so caregivers can review the day without blending observations into the person’s answer.</p>
        </div>
        <div className="checkin-events">
          {recentContext.length ? recentContext.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />) : <div className="checkin-empty-context">No other household observations yet.</div>}
        </div>
      </section>
      <QuestionSignalChart questions={questionsQuery.data ?? []} events={events.filter((event) => !event.careRecipientId || event.careRecipientId === recipientId)} days={7} title="Questions and signals this week" />
      <section className="panel checkin-week-card"><div><span className="eyebrow">WEEKLY CHECK-IN RHYTHM</span><h3>A calmer picture, over time</h3><p>Each day shows whether a check-in has been recorded for {residentName}.</p></div><div className="checkin-week-days" role="group" aria-label="Check-in days">{week.map((day, index) => <button key={day.label} className={selectedDay === index ? "selected" : ""} aria-pressed={selectedDay === index} onClick={() => setSelectedDay(index)}><i className={day.recorded ? "recorded" : ""} /><span>{day.label}</span></button>)}</div><div className="checkin-week-status">{week[selectedDay].recorded ? "Check-in recorded" : "No check-in recorded"}<small>{week[selectedDay].label}</small></div></section>
    </div>
  );
}
