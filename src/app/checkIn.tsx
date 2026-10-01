import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, demoMode } from "../api/client";
import type { HomeEvent, Session } from "../models/domain";
import { EventRow, formatTime } from "./shared";
import { QuestionSignalChart } from "./QuestionSignalChart";

export function CheckInPage({ events, session, onEvent, recipientId }: { events: HomeEvent[]; session?: Session; onEvent: (event: HomeEvent) => void; recipientId: string }) {
  const navigate = useNavigate();
  const summariesQuery = useQuery({ queryKey: ["caregiver-summaries", session?.home.id, recipientId], queryFn: () => api.getCaregiverSummaries(recipientId || null), enabled: demoMode || Boolean(session), retry: false });
  const questionsQuery = useQuery({ queryKey: ["check-in-questions", recipientId], queryFn: () => api.getCheckInQuestions(recipientId || null), enabled: demoMode || Boolean(session), retry: false });
  const today = new Date().toDateString();
  const todaySummary = summariesQuery.data?.find((item) => item.careRecipientId === recipientId && new Date(item.createdAt).toDateString() === today);
  const recipientsQuery = useQuery({ queryKey: ["care-recipients", session?.home.id], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(session), retry: false });
  const residentName = recipientsQuery.data?.find((person) => person.id === recipientId)?.display_name ?? session?.home.residentName ?? "Resident";
  const checkInEvent = events.find((event) => event.careRecipientId === recipientId && (event.eventType === "daily_check_in" || /check[- ]?in/i.test(event.title)) && new Date(event.occurredAt).toDateString() === today);
  const recentContext = events.filter((event) => event.id !== checkInEvent?.id).slice(0, 3);
  const completed = Boolean(checkInEvent || todaySummary);
  const [selectedDay, setSelectedDay] = useState(6);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const recorded = Boolean(summariesQuery.data?.some((item) => item.careRecipientId === recipientId && new Date(item.createdAt).toDateString() === date.toDateString())
      || events.some((event) => event.careRecipientId === recipientId && event.eventType === "daily_check_in" && new Date(event.occurredAt).toDateString() === date.toDateString()));
    return { label: new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric" }).format(date), recorded };
  });

  return (
    <div className="checkin-page">
      <header className="checkin-heading">
        <span className="eyebrow">TODAY</span>
        <h2>Today’s check-in</h2>
        <p>A calm human signal, compared with {residentName}’s own recent rhythm.</p>
      </header>

      <section className={`checkin-hero ${completed ? "complete" : "pending"}`}>
        <div className="checkin-hero-top">
          <span className="checkin-symbol"><HeartHandshake size={20} /></span>
          <span className="checkin-state"><i /> {completed ? "Completed today" : "Waiting today"}</span>
        </div>
        <div className="checkin-hero-copy">
          <span className="eyebrow">DAILY CHECK-IN</span>
          <h3>{completed ? "A familiar check-in is recorded." : "No check-in has been recorded yet."}</h3>
          <p>{checkInEvent?.detail ?? todaySummary?.explanation ?? "When the resident completes a check-in, ONE will place the result here and keep it in context with the personal baseline."}</p>
        </div>
        <div className="checkin-hero-meta">
          <span><Clock3 size={15} /> {checkInEvent ? `Recorded ${formatTime(checkInEvent.occurredAt)}` : todaySummary ? `Recorded ${formatTime(todaySummary.createdAt)}` : "Not recorded yet"}</span>
          <span><ShieldCheck size={15} /> Observation, not diagnosis</span>
        </div>
      </section>

      <div className="checkin-grid">
        <section className="panel checkin-flow-card">
          <div className="checkin-section-heading">
            <div><span className="eyebrow">HOW IT READS</span><h3>One signal, with context.</h3></div>
            {completed && <CheckCircle2 size={22} className="checkin-complete-icon" />}
          </div>
          <div className="checkin-flow">
            <div className={completed ? "done" : "current"}><span>1</span><div><strong>Familiar prompt</strong><small>A short daily check-in keeps the interaction predictable.</small></div></div>
            <i />
            <div className={completed ? "done" : "upcoming"}><span>2</span><div><strong>Human response</strong><small>The response is recorded as a signal, without turning it into a diagnosis.</small></div></div>
            <i />
            <div className={completed ? "done" : "upcoming"}><span>3</span><div><strong>Personal baseline</strong><small>Caregivers review changes against the resident’s own recent pattern.</small></div></div>
          </div>
          <button className="primary-button checkin-assistant-button" onClick={() => navigate("/dashboard/assistant")}>
            <Sparkles size={16} /> Explore with ONE <ArrowRight size={15} />
          </button>
        </section>

        <aside className="panel checkin-context-card">
          <span className="eyebrow">TODAY’S CONTEXT</span>
          <h3>Recent household signals</h3>
          <p className="muted">These observations stay separate from the check-in. They are here only to help a caregiver review the day in context.</p>
          <div className="checkin-events">
            {recentContext.length ? recentContext.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />) : <div className="checkin-empty-context">No other household observations yet.</div>}
          </div>
        </aside>
      </div>
      <QuestionSignalChart questions={questionsQuery.data ?? []} events={events.filter((event) => !event.careRecipientId || event.careRecipientId === recipientId)} days={7} title="Questions and signals this week" />
      <section className="panel checkin-week-card"><div><span className="eyebrow">WEEKLY CHECK-IN RHYTHM</span><h3>A calmer picture, over time</h3><p>Each day shows whether a check-in has been recorded for {residentName}.</p></div><div className="checkin-week-days" role="group" aria-label="Check-in days">{week.map((day, index) => <button key={day.label} className={selectedDay === index ? "selected" : ""} aria-pressed={selectedDay === index} onClick={() => setSelectedDay(index)}><i className={day.recorded ? "recorded" : ""} /><span>{day.label}</span></button>)}</div><div className="checkin-week-status">{week[selectedDay].recorded ? "Check-in recorded" : "No check-in recorded"}<small>{week[selectedDay].label}</small></div></section>
    </div>
  );
}
