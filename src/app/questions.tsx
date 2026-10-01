import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight } from "lucide-react";
import { api, demoMode, type CheckInQuestion } from "../api/client";
import "./questions.css";

type Range = "Today" | "7 Days" | "30 Days";
const displayTime = (value: string) => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
const displayDay = (value: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
const dayKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

function ResponseChart({ questions, range }: { questions: CheckInQuestion[]; range: Range }) {
  const days = range === "30 Days" ? 30 : 7;
  const buckets = useMemo(() => Array.from({ length: days }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (days - index - 1));
    const matching = questions.filter((item) => dayKey(new Date(item.askedAt)) === dayKey(date));
    const responseValues = matching.flatMap((item) => item.responseTimeMs === null ? [] : [item.responseTimeMs]);
    const baselineValues = matching.flatMap((item) => item.baselineMs === null ? [] : [item.baselineMs]);
    return { key: dayKey(date), label: displayDay(date), response: responseValues.length ? responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length : null, baseline: baselineValues.length ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length : null };
  }), [days, questions]);
  const seen = buckets.filter((item) => item.response !== null);
  const baseline = buckets.flatMap((item) => item.baseline === null ? [] : [item.baseline]);
  const baselineMs = baseline.length ? baseline.reduce((sum, value) => sum + value, 0) / baseline.length : null;
  const ceiling = Math.max(30_000, ...seen.map((item) => item.response ?? 0), baselineMs ?? 0);
  const point = (index: number, milliseconds: number) => ({ x: 52 + index * 660 / (days - 1), y: 184 - milliseconds / ceiling * 145 });
  const path = buckets.map((item, index) => item.response === null ? null : point(index, item.response)).filter((item): item is { x: number; y: number } => item !== null).map((item, index) => `${index ? "L" : "M"}${item.x} ${item.y}`).join(" ");
  return <div className="response-chart" role="img" aria-label={seen.length ? "Average response time compared with the personal baseline" : "No response-time data has been received"}>
    <div className="response-chart-heading"><div><span>RESPONSE TIME · LAST {days} DAYS</span><h3>Response time vs personal baseline</h3></div><small>{days} DAYS</small></div>
    <svg viewBox="0 0 760 220" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="signals-line" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#9decf4" /><stop offset="1" stopColor="#b7f8ff" /></linearGradient></defs>
      {[39,87,136,184].map((y) => <line key={y} x1="52" y1={y} x2="712" y2={y} stroke="#ffffff25" strokeWidth="1" />)}
      <text x="6" y="43">{Math.round(ceiling / 1000)}s</text><text x="8" y="90">{Math.round(ceiling * 2 / 3 / 1000)}s</text><text x="8" y="139">{Math.round(ceiling / 3 / 1000)}s</text><text x="19" y="188">0s</text>
      {baselineMs !== null && <line x1="52" y1={point(0, baselineMs).y} x2="712" y2={point(0, baselineMs).y} stroke="#b5eaf2" strokeDasharray="5 6" strokeWidth="1.5" />}
      {seen.length > 1 && <path d={path} fill="none" stroke="url(#signals-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {buckets.map((item, index) => item.response === null ? null : <circle key={item.key} cx={point(index, item.response).x} cy={point(index, item.response).y} r="5" fill="#c9f9ff" stroke="#0e6078" strokeWidth="1.5" />)}
      {buckets.filter((_, index) => days === 7 || index % 5 === 0 || index === days - 1).map((item) => <text key={item.key} className="chart-date" x={point(buckets.indexOf(item), 0).x} y="209" textAnchor="middle">{item.label}</text>)}
    </svg>
    <div className="response-chart-footer"><span><i className="average" /> Average response time</span><span><i className="baseline" /> Personal baseline{baselineMs !== null ? ` · ${Math.round(baselineMs / 1000)} sec` : ""}</span><em>Observed pattern · not a diagnosis</em></div>
    {!seen.length && <div className="response-chart-empty">Waiting for response times from the hub</div>}
  </div>;
}

export function QuestionsPage() {
  const [range, setRange] = useState<Range>("Today");
  const query = useQuery({ queryKey: ["check-in-questions"], queryFn: api.getCheckInQuestions, refetchInterval: demoMode ? false : 30_000, retry: false });
  const questions = query.data ?? [];
  const now = new Date();
  const filtered = questions.filter((item) => {
    const asked = new Date(item.askedAt);
    return range === "Today" ? dayKey(asked) === dayKey(now) : asked.getTime() >= now.getTime() - (range === "7 Days" ? 7 : 30) * 86_400_000;
  }).sort((a, b) => a.askedAt.localeCompare(b.askedAt));
  return <div className="questions-page">
    <header className="questions-heading"><div><span className="eyebrow">QUESTIONS & SIGNALS</span><h2>Questions & Signals</h2><p>Review the questions asked during check-ins and the signals around each answer.</p></div><div className="questions-range" role="group" aria-label="Time range">{(["Today", "7 Days", "30 Days"] as Range[]).map((option) => <button key={option} className={range === option ? "active" : ""} onClick={() => setRange(option)}>{option}</button>)}</div></header>
    <div className="questions-overview"><ResponseChart questions={questions} range={range} /><aside className="questions-context"><span className="eyebrow">WHY WE FOLLOW THIS</span><h3>Every answer has context.</h3><p>ONE compares response time with the person's own recent baseline.</p><div><Check size={15} /> Adapts to individual patterns</div><div><Check size={15} /> Helps identify meaningful changes</div><div><Check size={15} /> Keeps responses in context</div></aside></div>
    <section className="panel questions-table-panel"><div className="questions-table-heading"><div><h3>Questions asked {range === "Today" ? "today" : `in the last ${range.toLowerCase()}`}</h3><p>These are the questions received from the hub, with response times and related signals.</p></div><span>{filtered.length} questions <ChevronRight size={15} /></span></div><div className="questions-table-scroll"><table><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Pulse</th><th>Response time</th><th>Time</th></tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.question}</td><td><span className={item.answer ? "answer-ok" : "answer-missing"} />{item.answer || "No answer"}</td><td>{item.pulseBpm === null ? "—" : `${item.pulseBpm} BPM`}</td><td>{item.responseTimeMs === null ? "—" : `${Math.round(item.responseTimeMs / 1000)} seconds`}</td><td>{displayTime(item.askedAt)}</td></tr>)}</tbody></table>{!filtered.length && <p className="questions-empty">{query.isError ? "The hub could not be reached. Check the connection and try again." : "No questions received for this period."}</p>}</div></section>
    {demoMode && <p className="questions-demo-note">Demo data · connect the backend for household information.</p>}
  </div>;
}
