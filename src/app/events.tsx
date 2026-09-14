import type { HomeEvent } from "../models/domain";
import { EventRow } from "./shared";

export function EventsPage({ events, onEvent }: { events: HomeEvent[]; onEvent: (event: HomeEvent) => void }) {
  return <div className="events-page"><section className="page-heading-clean"><span className="eyebrow">EVENTS</span><h2>Events</h2><p>{events.length} observations available for review.</p></section><section className="panel events-results-panel"><div className="timeline-panel"><div className="timeline-date"><span>Today</span><span className="muted">September 12, 2026</span></div>{events.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />)}<div className="timeline-date older"><span>Yesterday</span><span className="muted">September 11, 2026</span></div><div className="empty-event">No additional events in this view.</div></div></section></div>;
}
