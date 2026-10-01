import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Box, Camera, LayoutGrid, UserRound } from "lucide-react";
import { api, demoMode } from "../api/client";
import type { HomeEvent } from "../models/domain";
import { EventRow } from "./shared";

type Category = "All events" | "People" | "Objects" | "Activity" | "Cameras";
const categories: { name: Category; icon: typeof Activity }[] = [
  { name: "All events", icon: LayoutGrid }, { name: "People", icon: UserRound },
  { name: "Objects", icon: Box }, { name: "Activity", icon: Activity }, { name: "Cameras", icon: Camera },
];

function categoryOf(event: HomeEvent): Exclude<Category, "All events"> {
  if (event.type === "object.last_seen" || event.eventType === "object_observed") return "Objects";
  if (event.type === "clip.created" || event.type === "device.status" || event.eventType?.includes("camera")) return "Cameras";
  if (event.eventType?.includes("person") || event.eventType?.includes("fall")) return "People";
  return "Activity";
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

export function EventsPage({ events, onEvent, recipientId }: { events: HomeEvent[]; onEvent: (event: HomeEvent) => void; recipientId: string }) {
  const [category, setCategory] = useState<Category>("All events");
  const recipientsQuery = useQuery({ queryKey: ["care-recipients", sessionStorage.getItem("one_home_id")], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(sessionStorage.getItem("one_access_token")), retry: false });
  const recipientName = recipientsQuery.data?.find((person) => person.id === recipientId)?.display_name ?? "Selected person";
  const groups = useMemo(() => {
    const scoped = events.filter((event) => category === "All events" || categoryOf(event) === category);
    const grouped = new Map<string, { key: string; date: string; owner: string; items: HomeEvent[] }>();
    for (const event of scoped) {
      const date = dateLabel(event.occurredAt);
      const owner = event.careRecipientId ? recipientName : "Household activity";
      const key = `${date}:${event.careRecipientId ?? "household"}`;
      const group = grouped.get(key) ?? { key, date, owner, items: [] };
      group.items.push(event);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [events, category, recipientName]);
  return <div className="events-page dashboard-page">
    <header className="page-heading-clean"><span className="eyebrow">EVENTS</span><h2>Events</h2><p>{events.length} observations available for review{demoMode ? " · sample data" : ""}.</p></header>
    <section className="panel events-results-panel">
      <div className="event-filters" role="group" aria-label="Event category">{categories.map(({ name, icon: Icon }) => <button key={name} className={category === name ? "active" : ""} aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={16} />{name}</button>)}</div>
      <div className="timeline-panel">{groups.map((group) => <section key={group.key} className="event-group"><div className="timeline-date"><span>{group.date} <small>· {group.owner}</small></span><span className="muted">{group.items.length} observations</span></div>{group.items.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />)}</section>)}{groups.length === 0 && <div className="empty-event">No {category === "All events" ? "observations" : category.toLowerCase() + " events"} for {recipientName} or the household in this view.</div>}</div>
    </section>
  </div>;
}
