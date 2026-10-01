import { useMemo, useState } from "react";
import { ArrowLeft, Clock3, MapPinned, Repeat2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, demoMode } from "../api/client";
import type { HomeEvent } from "../models/domain";
import "./careSummary.css";

type Period = "30 days" | "90 days" | "1 year";
const periodDays: Record<Period, number> = { "30 days": 30, "90 days": 90, "1 year": 365 };
const roomCenters: Record<string, { x: number; y: number }> = {
  "Living room": { x: 103, y: 91 }, Kitchen: { x: 225, y: 72 }, Hallway: { x: 190, y: 143 },
  Bedroom: { x: 72, y: 204 }, Bathroom: { x: 171, y: 209 }, Entryway: { x: 276, y: 147 },
};

function locationEvents(events: HomeEvent[], recipientId: string, days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return events.filter((event) => event.careRecipientId === recipientId && event.roomName && new Date(event.occurredAt).getTime() >= cutoff)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function CareSummaryPage({ recipientId }: { recipientId: string }) {
  const [period, setPeriod] = useState<Period>("30 days");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const days = periodDays[period];
  const questionsQuery = useQuery({ queryKey: ["check-in-questions", recipientId], queryFn: () => api.getCheckInQuestions(recipientId || null), enabled: demoMode || Boolean(sessionStorage.getItem("one_access_token")), retry: false });
  const eventsQuery = useQuery({ queryKey: ["events", "care-summary", recipientId], queryFn: () => api.getEvents(recipientId || null), enabled: demoMode || Boolean(sessionStorage.getItem("one_access_token")), retry: false });
  const recipientsQuery = useQuery({ queryKey: ["care-recipients", sessionStorage.getItem("one_home_id")], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(sessionStorage.getItem("one_access_token")), retry: false });
  const name = recipientsQuery.data?.find((person) => person.id === recipientId)?.display_name ?? "Care recipient";
  const questions = (questionsQuery.data ?? []).filter((item) => Date.now() - new Date(item.askedAt).getTime() <= days * 86_400_000);
  const places = useMemo(() => locationEvents(eventsQuery.data ?? [], recipientId, days), [eventsQuery.data, recipientId, days]);
  const averageDelay = questions.length ? questions.reduce((sum, item) => sum + (item.responseTimeMs ?? 0), 0) / questions.length : null;
  const baseline = questions.length ? questions.reduce((sum, item) => sum + (item.baselineMs ?? 0), 0) / questions.length : null;
  const repeated = questions.filter((item) => item.isRepeat).length;
  const rooms = [...new Set(places.flatMap((event) => event.roomName ? [event.roomName] : []))];
  const roomCounts = rooms.map((room) => ({ room, count: places.filter((event) => event.roomName === room).length, last: places.filter((event) => event.roomName === room).at(-1) }));
  const sequence = places.flatMap((event) => {
    const center = event.roomName ? roomCenters[event.roomName] : undefined;
    return center ? [{ ...center, room: event.roomName!, key: event.id }] : [];
  }).filter((_, index) => index === 0 || index === places.length - 1 || index % Math.max(1, Math.floor(places.length / 8)) === 0).slice(-8);

  const buckets = period === "1 year" ? 12 : Math.ceil(days / 7);
  const chartPoints = Array.from({ length: buckets }, (_, index) => {
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const start = new Date(endOfToday);
    let end = new Date(endOfToday);
    if (period === "1 year") {
      start.setDate(1);
      start.setMonth(start.getMonth() - (buckets - index - 1));
      end = new Date(start); end.setMonth(end.getMonth() + 1); end.setMilliseconds(-1);
    } else {
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1) + index * 7);
      end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
      if (end > endOfToday) end = endOfToday;
    }
    const items = questions.filter((item) => { const time = new Date(item.askedAt).getTime(); return time >= start.getTime() && time <= end.getTime(); });
    const label = period === "1 year" ? new Intl.DateTimeFormat("en", { month: "short" }).format(start) : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(start);
    return { date: start, label, questions: items.length, delay: items.length ? items.reduce((sum, item) => sum + (item.responseTimeMs ?? 0), 0) / items.length : null, repeats: items.filter((item) => item.isRepeat).length };
  });
  const maxDelay = Math.max(35_000, ...chartPoints.map((item) => item.delay ?? 0));
  const chartPath = chartPoints.flatMap((item, index) => item.delay === null ? [] : [`${index ? "L" : "M"}${35 + index * 620 / Math.max(1, chartPoints.length - 1)} ${169 - item.delay / maxDelay * 130}`]).join(" ");
  const locationPath = sequence.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const shortDay = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);

  return <div className="care-summary-page dashboard-page">
    <header className="care-summary-heading page-heading-clean"><Link className="care-summary-back" to="/dashboard/questions"><ArrowLeft size={15} /> Questions & Signals</Link><div><span className="eyebrow">PERSONAL CARE SUMMARY</span><h2>{name}’s recent pattern</h2><p>Review check-in timing, repeated prompts and household movement over time.</p></div><div className="care-summary-period" role="group" aria-label="Summary period">{(["30 days", "90 days", "1 year"] as Period[]).map((item) => <button key={item} className={period === item ? "active" : ""} aria-pressed={period === item} onClick={() => setPeriod(item)}>{item}</button>)}</div></header>
    <section className="care-summary-metrics">
      <article><span><Clock3 size={17} /> Average response time</span><strong>{averageDelay === null ? "—" : `${Math.round(averageDelay / 1000)} sec`}</strong><small>{baseline === null ? "No personal baseline yet" : `Personal baseline ${Math.round(baseline / 1000)} sec`}</small></article>
      <article><span><Repeat2 size={17} /> Extra questions</span><strong>{repeated}</strong><small>Follow-up questions recorded during check-ins</small></article>
      <article><span><MapPinned size={17} /> Rooms observed</span><strong>{rooms.length}</strong><small>{places.length} recorded location changes</small></article>
    </section>
    <div className="care-summary-grid">
      <section className="panel care-summary-chart-card"><div className="care-summary-card-heading"><div><span className="eyebrow">CHECK-IN RHYTHM</span><h3>Response time over the last {period}</h3><p>{period === "1 year" ? "Monthly" : "Weekly"} averages are compared with {name}’s own baseline.</p></div></div>
        {chartPoints.some((item) => item.delay !== null) ? <svg className="care-summary-line-chart" viewBox="0 0 700 220" role="img" aria-label={`Weekly response time for ${name}`}>
          {[40, 83, 126, 169].map((y) => <line key={y} x1="35" y1={y} x2="655" y2={y} className="summary-gridline" />)}
          {baseline !== null && <line x1="35" y1={169 - baseline / maxDelay * 130} x2="655" y2={169 - baseline / maxDelay * 130} className="summary-baseline-path" />}
          <path d={chartPath} pathLength="1" className="summary-delay-path" />
          {chartPoints.map((item, index) => item.delay === null ? null : <g key={item.date.toISOString()}><circle cx={35 + index * 620 / Math.max(1, chartPoints.length - 1)} cy={169 - item.delay / maxDelay * 130} r="5" className="summary-delay-point"><title>{`${item.label}: ${Math.round(item.delay / 1000)} seconds`}</title></circle><text x={35 + index * 620 / Math.max(1, chartPoints.length - 1)} y="203" textAnchor="middle">{item.label}</text></g>)}
        </svg> : <div className="care-summary-empty">No individual responses are available in this period.</div>}
        <div className="care-summary-legend"><span><i /> Average response time</span><span><i className="baseline-legend" /> Personal baseline</span></div>
      </section>
      <section className="panel care-summary-chart-card"><div className="care-summary-card-heading"><div><span className="eyebrow">FOLLOW-UP QUESTIONS</span><h3>Extra questions over time</h3><p>Follow-up questions by {period === "1 year" ? "month" : "week"}, without interpreting why.</p></div></div><div className="repeat-bars" role="img" aria-label={`Follow-up questions by ${period === "1 year" ? "month" : "week"}`}>{chartPoints.map((item) => <div key={item.date.toISOString()} title={`${item.label}: ${item.repeats} follow-up questions`}><i style={{ height: `${Math.max(5, item.repeats / Math.max(1, ...chartPoints.map((point) => point.repeats)) * 100)}%` }} /><span>{item.label}</span></div>)}</div><p className="care-summary-note">Changes can be useful context for a caregiver, but they are not a medical assessment.</p></section>
    </div>
    <section className="panel care-location-card"><div className="care-summary-card-heading"><div><span className="eyebrow">HOUSEHOLD MOVEMENT</span><h3>Location changes</h3><p>Observed room sequence in the selected period.</p></div><strong>{places.length} moments</strong></div>
      <div className="care-location-layout"><svg viewBox="0 0 320 270" role="img" aria-label="Illustrative home map showing room observations">
        <rect x="18" y="27" width="151" height="113" rx="5" className="summary-room living-room" /><rect x="179" y="27" width="116" height="88" rx="5" className="summary-room kitchen-room" /><rect x="179" y="122" width="116" height="42" rx="5" className="summary-room hall-room" /><rect x="18" y="150" width="104" height="94" rx="5" className="summary-room bedroom-room" /><rect x="132" y="174" width="80" height="70" rx="5" className="summary-room bath-room" />
        <text x="94" y="49">LIVING ROOM</text><text x="235" y="49">KITCHEN</text><text x="237" y="148">HALLWAY</text><text x="71" y="172">BEDROOM</text><text x="171" y="202">BATHROOM</text>
        {sequence.length > 1 && <path d={locationPath} className="summary-location-path" />}
        {sequence.map((point, index) => <g key={point.key}><circle cx={point.x} cy={point.y} r={index === sequence.length - 1 ? 8 : 5} className={index === sequence.length - 1 ? "summary-location-current" : "summary-location-dot"}><title>{point.room}</title></circle></g>)}
        {!sequence.length && <text x="160" y="257" className="summary-map-empty">No room observations in this period</text>}
      </svg><div className="care-location-list">{roomCounts.map((item) => <button key={item.room} className={activeRoom === item.room ? "active" : ""} onMouseEnter={() => setActiveRoom(item.room)} onMouseLeave={() => setActiveRoom(null)}><span><strong>{item.room}</strong><small>Last observed {item.last ? shortDay(new Date(item.last.occurredAt)) : "—"}</small></span><b>{item.count}</b></button>)}{!roomCounts.length && <p>Room observations will appear here when available.</p>}</div></div>
    </section>
    <p className="care-summary-footnote">Patterns are shown for care context. They do not diagnose dementia, MCI or Alzheimer’s disease.</p>
  </div>;
}
