import { Activity } from "lucide-react";
import type { HomeEvent } from "../models/domain";
import { EventRow } from "./shared";

export function EventsPage({ events, onEvent }: { events: HomeEvent[]; onEvent: (event: HomeEvent) => void }) {
  return <div className="events-page"><div className="filter-row"><button className="filter active">All moments</button><button className="filter">Objects</button><button className="filter">Check-ins</button><button className="filter">Clips</button><span className="filter-spacer" /><button className="icon-button" aria-label="Filter events"><Activity size={17} /></button></div><section className="panel timeline-panel"><div className="timeline-date"><span>Today</span><span className="muted">September 12, 2026</span></div>{events.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />)}<div className="timeline-date older"><span>Yesterday</span><span className="muted">September 11, 2026</span></div><div className="empty-event">Earlier moments are kept brief and purposeful.</div></section></div>;
}
