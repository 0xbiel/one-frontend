import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api, demoMode, type CheckInQuestion } from "../api/client";
import "./questions.css";
import "./questions-interactions.css";
import { QuestionSignalChart } from "./QuestionSignalChart";

type Range = "Today" | "7 Days" | "30 Days";
const displayTime = (value: string) => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
const displayDay = (value: Date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
const dayKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

function ResponseChart({ questions, range }: { questions: CheckInQuestion[]; range: Range }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const days = range === "Today" ? 1 : range === "30 Days" ? 30 : 7;
  const buckets = useMemo(() => Array.from({ length: days }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (days - index - 1));
    const matching = questions.filter((item) => dayKey(new Date(item.askedAt)) === dayKey(date));
    const responseValues = matching.flatMap((item) => item.responseTimeMs === null ? [] : [item.responseTimeMs]);
    const baselineValues = matching.flatMap((item) => item.baselineMs === null ? [] : [item.baselineMs]);
    return { key: dayKey(date), label: displayDay(date), response: responseValues.length ? responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length : null, baseline: baselineValues.length ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length : null };
  }), [days, questions]);
  const dailyQuestions = useMemo(() => {
    const today = new Date();
    return questions.filter(item => dayKey(new Date(item.askedAt)) === dayKey(today) && item.responseTimeMs !== null).sort((a, b) => a.askedAt.localeCompare(b.askedAt));
  }, [questions]);
  const daily = range === "Today";
  const seen = buckets.filter((item) => item.response !== null);
  const baseline = buckets.flatMap((item) => item.baseline === null ? [] : [item.baseline]);
  const baselineMs = baseline.length ? baseline.reduce((sum, value) => sum + value, 0) / baseline.length : null;
  const ceiling = Math.max(30_000, ...seen.map((item) => item.response ?? 0), ...dailyQuestions.map(item => item.responseTimeMs ?? 0), baselineMs ?? 0);
  const point = (index: number, milliseconds: number, total = days) => ({ x: total === 1 ? 380 : 52 + index * 660 / (total - 1), y: 184 - milliseconds / ceiling * 145 });
  const path = buckets.map((item, index) => item.response === null ? null : point(index, item.response)).filter((item): item is { x: number; y: number } => item !== null).map((item, index) => `${index ? "L" : "M"}${item.x} ${item.y}`).join(" ");
  const dailyPath = dailyQuestions.map((item, index) => point(index, item.responseTimeMs ?? 0, dailyQuestions.length)).map((item, index) => `${index ? "L" : "M"}${item.x} ${item.y}`).join(" ");
  const hoverQuestion = dailyQuestions.find(item => item.id === hovered);
  const hoverBucket = buckets.find(item => item.key === hovered);
  const hoverPoint = daily && hoverQuestion ? point(dailyQuestions.indexOf(hoverQuestion), hoverQuestion.responseTimeMs ?? 0, dailyQuestions.length) : hoverBucket ? point(buckets.indexOf(hoverBucket), hoverBucket.response ?? 0) : null;
  const tooltipX = hoverPoint ? Math.max(3, Math.min(566, hoverPoint.x - 92)) : 0;
  const tooltipY = hoverPoint ? Math.max(2, hoverPoint.y - 74) : 0;
  return <div className="response-chart" aria-label={daily ? "Response times for each question today" : "Average response time compared with the personal baseline"}>
    <div className="response-chart-heading"><div><span>{daily ? "RESPONSE TIME · TODAY" : `RESPONSE TIME · LAST ${days} DAYS`}</span><h3>{daily ? "Time for each answer" : "Response time vs personal baseline"}</h3></div><small>{daily ? `${dailyQuestions.length} ANSWERS` : `${days} DAYS`}</small></div>
    <svg viewBox="0 0 760 220" preserveAspectRatio="none" role="group" aria-label={daily ? "Hover a point to see response time for each question" : "Hover a day to see question response time"} onMouseLeave={() => setHovered(null)}>
      <defs><linearGradient id="signals-line" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#9decf4" /><stop offset="1" stopColor="#b7f8ff" /></linearGradient></defs>
      {[39,87,136,184].map((y) => <line key={y} x1="52" y1={y} x2="712" y2={y} stroke="#ffffff25" strokeWidth="1" />)}
      <text x="6" y="43">{Math.round(ceiling / 1000)}s</text><text x="8" y="90">{Math.round(ceiling * 2 / 3 / 1000)}s</text><text x="8" y="139">{Math.round(ceiling / 3 / 1000)}s</text><text x="19" y="188">0s</text>
      {baselineMs !== null && <line x1="52" y1={point(0, baselineMs).y} x2="712" y2={point(0, baselineMs).y} stroke="#b5eaf2" strokeDasharray="5 6" strokeWidth="1.5" />}
      {daily ? <>
        {dailyQuestions.length > 1 && <path className="response-chart-line" key={range} d={dailyPath} pathLength="1" fill="none" stroke="url(#signals-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {dailyQuestions.map((item, index) => { const position = point(index, item.responseTimeMs ?? 0, dailyQuestions.length); return <g key={item.id} className="response-chart-interactive-point" onMouseEnter={() => setHovered(item.id)} onFocus={() => setHovered(item.id)} onBlur={() => setHovered(null)}><circle cx={position.x} cy={position.y} r="12" fill="transparent" /><circle className="response-chart-point" cx={position.x} cy={position.y} r={hovered === item.id ? "7" : "5"} fill="#c9f9ff" stroke="#0e6078" strokeWidth="1.5" tabIndex={0} role="button" aria-label={`${item.question}: ${Math.round((item.responseTimeMs ?? 0) / 1000)} seconds`} /><text className="chart-date" x={position.x} y="209" textAnchor="middle">{displayTime(item.askedAt)}</text></g>; })}
      </> : <>
        {seen.length > 1 && <path className="response-chart-line" key={range} d={path} pathLength="1" fill="none" stroke="url(#signals-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {buckets.map((item, index) => item.response === null ? null : <g key={item.key} className="response-chart-interactive-point" onMouseEnter={() => setHovered(item.key)} onFocus={() => setHovered(item.key)} onBlur={() => setHovered(null)}><circle cx={point(index, item.response).x} cy={point(index, item.response).y} r="12" fill="transparent" /><circle className="response-chart-point" cx={point(index, item.response).x} cy={point(index, item.response).y} r={hovered === item.key ? "7" : "5"} fill="#c9f9ff" stroke="#0e6078" strokeWidth="1.5" tabIndex={0} role="button" aria-label={`${item.label}: ${Math.round(item.response / 1000)} seconds average`} /><text className="chart-date" x={point(index, 0).x} y="209" textAnchor="middle">{item.label}</text></g>)}
      </>}
      {hoverPoint && <foreignObject x={tooltipX} y={tooltipY} width="190" height="68" className="response-chart-tooltip-wrap" aria-hidden="true"><div className="response-chart-tooltip">{hoverQuestion ? <><strong>{displayTime(hoverQuestion.askedAt)} · {Math.round((hoverQuestion.responseTimeMs ?? 0) / 1000)} sec</strong><span>{hoverQuestion.question}</span><span>{hoverQuestion.answer}</span></> : hoverBucket ? <><strong>{hoverBucket.label} · {Math.round((hoverBucket.response ?? 0) / 1000)} sec avg</strong><span>{questions.filter(item => dayKey(new Date(item.askedAt)) === hoverBucket.key).length} questions answered</span></> : null}</div></foreignObject>}
    </svg>
    {hoverQuestion && <div className="chart-selection" role="status">{hoverQuestion.question} · {Math.round((hoverQuestion.responseTimeMs ?? 0) / 1000)} seconds</div>}
    <div className="response-chart-footer"><span><i className="average" /> {daily ? "Response time per answer" : "Average response time"}</span>{!daily && <span><i className="baseline" /> Personal baseline{baselineMs !== null ? ` · ${Math.round(baselineMs / 1000)} sec` : ""}</span>}<em>Observed pattern · not a diagnosis</em></div>
    {!(daily ? dailyQuestions.length : seen.length) && <div className="response-chart-empty">{demoMode ? "No answers for this person or period" : "Individual response times are not stored yet"}</div>}
  </div>;
}

export function QuestionsPage({ recipientId }: { recipientId: string }) {
  const [range, setRange] = useState<Range>("Today");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const query = useQuery({ queryKey: ["check-in-questions", recipientId], queryFn: () => api.getCheckInQuestions(recipientId || null), refetchInterval: demoMode ? false : 30_000, retry: false });
  const eventsQuery = useQuery({ queryKey: ["events", "question-signals", recipientId], queryFn: () => api.getEvents(recipientId || null), retry: false });
  const recipientsQuery = useQuery({ queryKey: ["care-recipients", sessionStorage.getItem("one_home_id")], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(sessionStorage.getItem("one_access_token")), retry: false });
  const recipientName = recipientsQuery.data?.find(person => person.id === recipientId)?.display_name ?? "Care recipient";
  const questions = query.data ?? [];
  const now = new Date();
  const filtered = questions.filter((item) => {
    const asked = new Date(item.askedAt);
    return range === "Today" ? dayKey(asked) === dayKey(now) : asked.getTime() >= now.getTime() - (range === "7 Days" ? 7 : 30) * 86_400_000;
  }).sort((a, b) => a.askedAt.localeCompare(b.askedAt));
  const previewLimit = 3;
  const visibleQuestions = range === "Today" || historyExpanded ? filtered : filtered.slice(0, previewLimit);
  const hasExpandableHistory = range !== "Today" && filtered.length > previewLimit;
  return <div className="questions-page">
    <header className="questions-heading"><div><span className="eyebrow">QUESTIONS & SIGNALS</span><h2>Questions & Signals</h2><p>Review the questions asked during check-ins and the signals around each answer.</p></div><div className="questions-heading-actions"><Link className="questions-summary-link" to="/dashboard/questions/summary">Care summary <ArrowUpRight size={15} /></Link><div className="questions-range" role="group" aria-label="Time range">{(["Today", "7 Days", "30 Days"] as Range[]).map((option) => <button key={option} className={range === option ? "active" : ""} aria-pressed={range === option} onClick={() => { setRange(option); setHistoryExpanded(false); }}>{option}</button>)}</div></div></header>
    <QuestionSignalChart questions={questions} events={eventsQuery.data ?? []} days={range === "Today" ? 1 : range === "7 Days" ? 7 : 30} />
    <div className="questions-overview"><ResponseChart questions={questions} range={range} /><aside className="questions-context"><span className="eyebrow">ABOUT PERSONAL BASELINE</span><h3>{demoMode ? `${recipientName}’s recent pattern` : "Question history is not available yet"}</h3><p>{demoMode ? recipientId === "recipient-manuel" ? "Recent replies take longer, with more follow-up prompts and a few answers that need a second look." : `${recipientName}’s familiar check-in responses remain close to the recent routine.` : "Check-in summaries are available, but the service does not store individual answers or response times yet."}</p><div><Check size={15} /> Adapts to individual patterns</div><div><Check size={15} /> Helps identify meaningful changes</div><div><Check size={15} /> Keeps responses in context</div></aside></div>
    <section className="panel questions-table-panel"><div className="questions-table-heading"><div><h3>Questions asked {range === "Today" ? "today" : `in the last ${range.toLowerCase()}`}</h3><p>{demoMode ? "Response times and related signals for the selected period." : "Question-level history will appear here when the service supports it."}</p></div>{hasExpandableHistory ? <button className={`questions-history-toggle${historyExpanded ? " expanded" : ""}`} type="button" aria-expanded={historyExpanded} aria-controls="questions-history-table" aria-label={historyExpanded ? "Show fewer questions" : `Show all ${filtered.length} questions`} onClick={() => setHistoryExpanded((expanded) => !expanded)}><span>{filtered.length} questions</span><ChevronRight size={15} aria-hidden="true" /></button> : <span className="questions-history-count">{filtered.length} {filtered.length === 1 ? "question" : "questions"}</span>}</div><div id="questions-history-table" className="questions-table-scroll"><table><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Pulse</th><th>Response time</th><th>Day</th><th>Time</th></tr></thead><tbody>{visibleQuestions.map((item) => { const index = filtered.findIndex((question) => question.id === item.id); return <tr key={item.id}><td>{index + 1}</td><td>{item.question}{item.isRepeat && <small className="repeat-question-label">Asked again</small>}</td><td><span className={item.answer ? "answer-ok" : "answer-missing"} />{item.answer || "No answer"}{item.answerAccuracy === "inaccurate" && <small className="answer-needs-review">May not match the question</small>}</td><td>{item.pulseBpm === null ? "—" : `${item.pulseBpm} BPM`}</td><td>{item.responseTimeMs === null ? "—" : `${Math.round(item.responseTimeMs / 1000)} seconds`}</td><td>{displayDay(new Date(item.askedAt))}</td><td>{displayTime(item.askedAt)}</td></tr>; })}</tbody></table>{!filtered.length && <p className="questions-empty">{query.isError ? "The history could not be loaded." : demoMode ? "No questions for this person or period." : "Individual questions and response times are not available from the current API."}</p>}</div></section>
  </div>;
}
