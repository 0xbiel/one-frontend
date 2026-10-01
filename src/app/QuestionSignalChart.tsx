import { useMemo, useState } from "react";
import type { CheckInQuestion } from "../api/client";
import type { HomeEvent } from "../models/domain";
import "./QuestionSignalChart.css";
import "./QuestionSignalChart.interactions.css";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shortDate = (date: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
const shortTime = (date: Date) => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);

interface Point { x: number; y: number; }

export function QuestionSignalChart({ questions, events, days = 7, title = "Questions and household signals" }: { questions: CheckInQuestion[]; events: HomeEvent[]; days?: number; title?: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const buckets = useMemo(() => Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    date.setHours(12, 0, 0, 0);
    const key = dateKey(date);
    const dayQuestions = questions.filter((item) => dateKey(new Date(item.askedAt)) === key);
    const responseTimes = dayQuestions.flatMap(item => item.responseTimeMs === null ? [] : [item.responseTimeMs]);
    return {
      key,
      date,
      questions: dayQuestions.length,
      signals: events.filter((item) => dateKey(new Date(item.occurredAt)) === key).length,
      averageResponseMs: responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null,
    };
  }), [days, events, questions]);
  const todayKey = dateKey(new Date());
  const todayQuestions = useMemo(() => questions
    .filter(item => dateKey(new Date(item.askedAt)) === todayKey && item.responseTimeMs !== null)
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt)), [questions, todayKey]);
  const isSingleDay = days === 1;
  const singleDayCeiling = Math.max(20_000, ...todayQuestions.map(item => item.responseTimeMs ?? 0));
  const countCeiling = Math.max(4, ...buckets.flatMap((item) => [item.questions, item.signals]));
  const valueCeiling = isSingleDay ? singleDayCeiling : countCeiling;
  const point = (index: number, value: number, total = days): Point => ({
    x: total === 1 ? 380 : 54 + index * 650 / Math.max(1, total - 1),
    y: 171 - value / valueCeiling * 130,
  });
  const pathFor = (key: "questions" | "signals") => buckets.map((item, index) => {
    const target = point(index, item[key]);
    return `${index ? "L" : "M"}${target.x} ${target.y}`;
  }).join(" ");
  const responsePath = todayQuestions.map((item, index) => {
    const target = point(index, item.responseTimeMs ?? 0, todayQuestions.length);
    return `${index ? "L" : "M"}${target.x} ${target.y}`;
  }).join(" ");
  const visibleLabels = buckets.filter((_, index) => days <= 7 || index % Math.ceil(days / 6) === 0 || index === days - 1);
  const hoveredQuestion = todayQuestions.find(item => item.id === hovered);
  const activeDay = buckets.find(item => item.key === hovered) ?? buckets.at(-1);
  const activePoint = isSingleDay && hoveredQuestion
    ? point(todayQuestions.indexOf(hoveredQuestion), hoveredQuestion.responseTimeMs ?? 0, todayQuestions.length)
    : activeDay ? point(buckets.indexOf(activeDay), Math.max(activeDay.questions, activeDay.signals)) : null;
  const tooltipX = activePoint ? Math.max(8, Math.min(580, activePoint.x - 84)) : 0;
  const tooltipY = activePoint ? Math.max(3, activePoint.y - 76) : 0;

  return <section className="question-signal-chart" aria-label={title}>
    <div className="question-signal-chart-heading"><div><span className="eyebrow">DAILY ACTIVITY</span><h3>{title}</h3></div><span className="question-signal-range">{isSingleDay ? "TODAY" : `LAST ${days} DAYS`}</span></div>
    <svg viewBox="0 0 760 210" role="group" aria-label={isSingleDay ? "Response time for each question today" : `Daily questions and signals across ${days} days`} onMouseLeave={() => setHovered(null)}>
      {[42, 84, 126, 168].map((y) => <line key={y} x1="54" y1={y} x2="706" y2={y} className="question-signal-gridline" />)}
      {isSingleDay ? <>
        {[0, .33, .66, 1].map((ratio, index) => <text key={index} x="13" y={171 - ratio * 130} className="question-signal-date">{Math.round(singleDayCeiling * ratio / 1000)}s</text>)}
        {todayQuestions.length > 1 && <path d={responsePath} pathLength="1" className="question-signal-line question-signal-response-line" />}
        {todayQuestions.map((item, index) => {
          const position = point(index, item.responseTimeMs ?? 0, todayQuestions.length);
          const key = shortTime(new Date(item.askedAt));
          return <g key={item.id} className="question-signal-day" onMouseEnter={() => setHovered(item.id)} onFocus={() => setHovered(item.id)} onBlur={() => setHovered(null)}>
            <circle cx={position.x} cy={position.y} r="13" className="question-signal-hit" />
            <circle cx={position.x} cy={position.y} r={hovered === item.id ? "6" : "4.5"} className="question-signal-point question-point" tabIndex={0} role="button" aria-label={`${item.question}, ${Math.round((item.responseTimeMs ?? 0) / 1000)} seconds`} />
            <text x={position.x} y="199" className="question-signal-date" textAnchor="middle">{key}</text>
          </g>;
        })}
      </> : <>
        <text x="13" y="46" className="question-signal-date">{countCeiling}</text>
        <text x="20" y="174" className="question-signal-date">0</text>
        <path d={pathFor("signals")} pathLength="1" className="question-signal-line signal-line" />
        <path d={pathFor("questions")} pathLength="1" className="question-signal-line question-line" />
        {buckets.map((item, index) => {
          const value = Math.max(item.questions, item.signals);
          const position = point(index, value);
          return <g key={item.key} className="question-signal-day" onMouseEnter={() => setHovered(item.key)} onFocus={() => setHovered(item.key)} onBlur={() => setHovered(null)}>
            <circle cx={position.x} cy={position.y} r="13" className="question-signal-hit" />
            <circle cx={position.x} cy={position.y} r={hovered === item.key ? "5.5" : "4"} className="question-signal-point question-point" tabIndex={0} role="button" aria-label={`${shortDate(item.date)}: ${item.questions} questions, ${item.signals} signals${item.averageResponseMs === null ? "" : `, average response ${Math.round(item.averageResponseMs / 1000)} seconds`}`} />
            <title>{`${shortDate(item.date)} · ${item.questions} questions · ${item.signals} signals`}</title>
          </g>;
        })}
        {visibleLabels.map((item) => <text key={item.key} x={point(buckets.indexOf(item), 0).x} y="199" className="question-signal-date" textAnchor="middle">{shortDate(item.date)}</text>)}
      </>}
      {activePoint && (hoveredQuestion || hovered) && <foreignObject x={tooltipX} y={tooltipY} width="176" height="69" className="question-signal-tooltip-wrap" aria-hidden="true">
        <div className="question-signal-tooltip">
          {hoveredQuestion ? <><strong>{shortTime(new Date(hoveredQuestion.askedAt))} · {Math.round((hoveredQuestion.responseTimeMs ?? 0) / 1000)} sec</strong><span>{hoveredQuestion.question}</span></> : activeDay ? <><strong>{shortDate(activeDay.date)}</strong><span>{activeDay.questions} questions · {activeDay.signals} signals</span><span>{activeDay.averageResponseMs === null ? "No response time recorded" : `Average response · ${Math.round(activeDay.averageResponseMs / 1000)} sec`}</span></> : null}
        </div>
      </foreignObject>}
    </svg>
    <div className="question-signal-chart-footer">{isSingleDay ? <><span><i className="response-key" />Response time</span><span>{todayQuestions.length} answers today</span></> : <><span><i className="questions-key" />Questions answered</span><span><i className="signals-key" />Household signals</span></>}<strong aria-live="polite">{isSingleDay ? (hoveredQuestion ? `${hoveredQuestion.question} · ${Math.round((hoveredQuestion.responseTimeMs ?? 0) / 1000)} sec` : `${todayQuestions.length} answers today`) : activeDay ? `${shortDate(activeDay.date)} · ${activeDay.questions} questions · ${activeDay.signals} signals` : "No activity recorded"}</strong></div>
  </section>;
}
