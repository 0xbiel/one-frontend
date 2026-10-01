import type { HomeEvent } from "../models/domain";
import { EventRow } from "./shared";

export function EventsPage({ events, onEvent }: { events: HomeEvent[]; onEvent: (event: HomeEvent) => void }) {
  const groups = new Map<string, HomeEvent[]>();
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const key = Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric" }).format(date);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return <div className="events-page"><section className="page-heading-clean"><span className="eyebrow">EVENTS</span><h2>Events</h2><p>{events.length} observations available for review.</p></section><section className="panel events-results-panel"><div className="timeline-panel">{[...groups.entries()].map(([date, items]) => <div key={date}><div className="timeline-date"><span>{date}</span><span className="muted">{items.length} observations</span></div>{items.map(event => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />)}</div>)}{events.length === 0 && <div className="empty-event">No observations received yet. Events from connected cameras will appear here.</div>}</div></section></div>;
}
