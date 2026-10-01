import { useMemo, useState } from "react";
import type { CheckInQuestion } from "../api/client";
import type { HomeEvent } from "../models/domain";
import "./QuestionSignalChart.css";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shortDate = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);

interface Point { x: number; y: number; }

export function QuestionSignalChart({ questions, events, days = 7, title = "Questions and household signals" }: { questions: CheckInQuestion[]; events: HomeEvent[]; days?: number; title?: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const buckets = useMemo(() => Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    date.setHours(12, 0, 0, 0);
    const key = dateKey(date);
    return {
      key,
      date,
      questions: questions.filter((item) => dateKey(new Date(item.askedAt)) === key).length,
      signals: events.filter((item) => dateKey(new Date(item.occurredAt)) === key).length,
    };
  }), [days, events, questions]);
  const ceiling = Math.max(4, ...buckets.flatMap((item) => [item.questions, item.signals]));
  const point = (index: number, value: number): Point => ({ x: 54 + index * 650 / Math.max(1, days - 1), y: 171 - value / ceiling * 130 });
  const pathFor = (key: "questions" | "signals") => buckets.map((item, index) => {
    const target = point(index, item[key]);
    return `${index ? "L" : "M"}${target.x} ${target.y}`;
  }).join(" ");
  const visibleLabels = buckets.filter((_, index) => days <= 7 || index % Math.ceil(days / 6) === 0 || index === days - 1);
  const active = buckets.find((item) => item.key === hovered) ?? buckets.at(-1);

  return <section className="question-signal-chart" aria-label={title}>
    <div className="question-signal-chart-heading"><div><span className="eyebrow">DAILY ACTIVITY</span><h3>{title}</h3></div><span className="question-signal-range">{days === 1 ? "TODAY" : `LAST ${days} DAYS`}</span></div>
    <svg viewBox="0 0 760 210" role="group" aria-label={`Daily questions and signals across ${days} days`}>
      {[42, 84, 126, 168].map((y) => <line key={y} x1="54" y1={y} x2="706" y2={y} className="question-signal-gridline" />)}
      {buckets.length > 1 && <path d={pathFor("signals")} pathLength="1" className="question-signal-line signal-line" />}
      {buckets.length > 1 && <path d={pathFor("questions")} pathLength="1" className="question-signal-line question-line" />}
      {buckets.map((item, index) => {
        const position = point(index, item.questions);
        return <g key={item.key} className="question-signal-day" onMouseEnter={() => setHovered(item.key)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(item.key)} onBlur={() => setHovered(null)}>
          <circle cx={position.x} cy={position.y} r="12" className="question-signal-hit" />
          <circle cx={position.x} cy={position.y} r={hovered === item.key ? "5.5" : "4"} className="question-signal-point question-point" tabIndex={0} role="button" aria-label={`${shortDate(item.date)}: ${item.questions} questions, ${item.signals} signals`} />
          <title>{`${shortDate(item.date)} · ${item.questions} questions · ${item.signals} signals`}</title>
        </g>;
      })}
      {visibleLabels.map((item) => <text key={item.key} x={point(buckets.indexOf(item), 0).x} y="199" className="question-signal-date" textAnchor="middle">{shortDate(item.date)}</text>)}
    </svg>
    <div className="question-signal-chart-footer"><span><i className="questions-key" />Questions answered</span><span><i className="signals-key" />Household signals</span><strong aria-live="polite">{active ? `${shortDate(active.date)} · ${active.questions} questions · ${active.signals} signals` : "No activity recorded"}</strong></div>
  </section>;
}
