import type { DayStory } from "../api/client";

export function DayStoryCard({ story, loading, error }: { story?: DayStory; loading?: boolean; error?: boolean }) {
  return <section className="panel day-story-card" aria-labelledby="day-story-title"><div className="section-heading"><div><span className="eyebrow">TODAY</span><h3 id="day-story-title">{story?.headline || "Today’s story"}</h3></div>{story?.synthetic && <span className="day-origin-badge">Simulated data</span>}</div>{loading ? <p role="status">Gathering today’s recorded context…</p> : error ? <p role="status">Today’s story is unavailable. Your existing observations and check-in remain below.</p> : !story ? <p>Select a person receiving care to see their recorded day.</p> : <><p className="day-story-summary">{story.summary}</p>{story.attention_items.length > 0 && <div className="day-attention"><h4>Worth a look</h4>{story.attention_items.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div>}{story.routine.status === "unknown" && <p className="muted day-uncertainty">{story.routine.reason}</p>}<p className="muted">{story.coverage.simple_label}. Gaps in records do not mean inactivity.</p></>}</section>;
}

export function DayStoryDetails({ story }: { story?: DayStory }) {
  if (!story) return null;
  return <details className="panel day-story-details"><summary>Activity details</summary><p>{story.coverage.observation_count} recorded observations · {story.window.timezone} · current day is partial.</p>{story.coverage.last_observed_at && <p>Last recorded signal: {new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: story.window.timezone }).format(new Date(story.coverage.last_observed_at))}</p>}<p>{story.coverage.missing_means}</p>{story.limitations.map((item) => <p className="muted" key={item}>{item}</p>)}{story.facts.map((item, index) => <div key={index}><p>{item.text}</p></div>)}</details>;
}
