import { useMemo, useState } from "react";
import { ArrowLeft, ListFilter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { CareAnalytics, HomeEvent } from "../models/domain";
import { EventRow } from "./shared";

export function EventsPage({ events, analytics, onEvent }: { events: HomeEvent[]; analytics?: CareAnalytics; onEvent: (event: HomeEvent) => void }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "review" | "movement">("all");
  const fallEvents = events.filter((event) => event.type === "fall.suspected" && event.status === "needs_review");
  const groupedEvents = useMemo(() => {
    const sorted = [...events].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
    const groups: HomeEvent[] = [];
    for (const event of sorted) {
      const previous = groups[groups.length - 1];
      const sameMovement = event.type === "object.last_seen"
        && previous?.type === event.type
        && previous.title === event.title
        && Math.abs(Date.parse(previous.occurredAt) - Date.parse(event.occurredAt)) <= 90_000;
      if (sameMovement) {
        previous.occurrenceCount = (previous.occurrenceCount ?? 1) + (event.occurrenceCount ?? 1);
        previous.firstSeenAt = [previous.firstSeenAt ?? previous.occurredAt, event.firstSeenAt ?? event.occurredAt].sort()[0];
      } else {
        groups.push({ ...event });
      }
    }
    return groups;
  }, [events]);
  const visibleEvents = groupedEvents.filter((event) => filter === "all" || (filter === "review" ? event.status === "needs_review" : event.type === "object.last_seen"));
  const movementCount = groupedEvents.filter((event) => event.type === "object.last_seen").length;
  const reviewCount = groupedEvents.filter((event) => event.status === "needs_review").length;
  return <div className="events-page">
    <section className="page-heading-clean events-heading">
      <button className="events-back-button" type="button" onClick={() => navigate("/dashboard")}><ArrowLeft size={16} /> Back to overview</button>
      <div className="events-heading-copy"><span className="eyebrow">EVENTS · CAREGIVER REVIEW</span><h2>Events</h2><p>{events.length} raw signals condensed into {groupedEvents.length} review items. Repeated movement is grouped instead of shown once per camera frame.</p></div>
    </section>
    {fallEvents.length > 0 && <section className="safety-review-note" role="status"><span className="eyebrow">SAFETY SIGNAL · NEEDS REVIEW</span><strong>{fallEvents.length === 1 ? "A possible fall pattern needs a check-in." : `${fallEvents.length} possible fall patterns need review.`}</strong><span>Open the event for the observed context. ONE does not diagnose falls.</span></section>}
    <section className="events-summary-row" aria-label="Event summary">
      <div className="events-summary-card"><span className="eyebrow">REVIEW ITEMS</span><strong>{groupedEvents.length}</strong><span>Grouped household signals</span></div>
      <div className="events-summary-card"><span className="eyebrow">MOVEMENT</span><strong>{movementCount}</strong><span>Repeated observations condensed</span></div>
      <div className="events-summary-card attention"><span className="eyebrow">NEEDS REVIEW</span><strong>{reviewCount}</strong><span>Human follow-up only</span></div>
    </section>
    <section className="panel events-results-panel">
      <div className="filter-row events-filter-row" aria-label="Event filters">
        <span className="events-filter-label"><ListFilter size={15} /> Show</span>
        <button type="button" className={`filter ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All <span>{groupedEvents.length}</span></button>
        <button type="button" className={`filter ${filter === "review" ? "active" : ""}`} onClick={() => setFilter("review")}>Needs review <span>{reviewCount}</span></button>
        <button type="button" className={`filter ${filter === "movement" ? "active" : ""}`} onClick={() => setFilter("movement")}>Movement <span>{movementCount}</span></button>
      </div>
      <div className="timeline-panel">
        <div className="timeline-date"><span>Recent</span><span className="muted">Reviewable household signals</span></div>
        {visibleEvents.length ? visibleEvents.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />) : <div className="empty-event">No events match this filter. Try All to see the complete review history.</div>}
        <div className="timeline-date older"><span>Retention</span><span className="muted">Encrypted evidence stays reviewable for its retention window</span></div>
        <div className="empty-event">ONE reports observations for caregiver review; grouped movement is not a diagnosis.</div>
      </div>
    </section>
  </div>;
}
