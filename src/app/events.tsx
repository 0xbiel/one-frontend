import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Box, Camera, LayoutGrid, UserRound } from "lucide-react";
import { api, demoMode } from "../api/client";
import type { HomeEvent } from "../models/domain";
import { EventRow } from "./shared";

type Category = "All events" | "People" | "Objects" | "Activity" | "Cameras";
type Period = "1 year" | "6 months" | "3 months" | "1 month" | "2 weeks" | "1 week" | "Today";
const periods: Period[] = ["1 year", "6 months", "3 months", "1 month", "2 weeks", "1 week", "Today"];
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
  const [period, setPeriod] = useState<Period>("1 month");
  const recipientsQuery = useQuery({ queryKey: ["care-recipients", sessionStorage.getItem("one_home_id")], queryFn: api.getCareRecipients, enabled: demoMode || Boolean(sessionStorage.getItem("one_access_token")), retry: false });
  const recipientName = recipientsQuery.data?.find((person) => person.id === recipientId)?.display_name ?? "Selected person";
  const filteredEvents = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    if (period === "Today") { /* Keep today's midnight as the lower bound. */ }
    else if (period === "1 week") start.setDate(start.getDate() - 7);
    else if (period === "2 weeks") start.setDate(start.getDate() - 14);
    else if (period === "1 month") start.setMonth(start.getMonth() - 1);
    else if (period === "3 months") start.setMonth(start.getMonth() - 3);
    else if (period === "6 months") start.setMonth(start.getMonth() - 6);
    else start.setFullYear(start.getFullYear() - 1);
    return events.filter((event) => new Date(event.occurredAt).getTime() >= start.getTime())
      .filter((event) => category === "All events" || categoryOf(event) === category)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [events, period, category]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { key: string; date: string; owner: string; items: HomeEvent[] }>();
    for (const event of filteredEvents) {
      const date = dateLabel(event.occurredAt);
      const owner = event.careRecipientId ? recipientName : "Household activity";
      const key = `${date}:${event.careRecipientId ?? "household"}`;
      const group = grouped.get(key) ?? { key, date, owner, items: [] };
      group.items.push(event);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [filteredEvents, recipientName]);
  return <div className="events-page dashboard-page">
    <header className="page-heading-clean"><span className="eyebrow">EVENTS</span><h2>Events</h2><p>{filteredEvents.length} observations available for review.</p></header>
    <section className="panel events-results-panel">
      <div className="event-filter-toolbar"><div className="event-filters" role="group" aria-label="Event category">{categories.map(({ name, icon: Icon }) => <button key={name} className={category === name ? "active" : ""} aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={16} />{name}</button>)}</div><div className="event-period-filters" role="group" aria-label="Event date range">{periods.map((item) => <button key={item} className={period === item ? "active" : ""} aria-pressed={period === item} onClick={() => setPeriod(item)}>{item}</button>)}</div></div>
      <div className="timeline-panel">{groups.map((group) => <section key={group.key} className="event-group"><div className="timeline-date"><span>{group.date} <small>· {group.owner}</small></span><span className="muted">{group.items.length} observations</span></div>{group.items.map((event) => <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />)}</section>)}{groups.length === 0 && <div className="empty-event">No {category === "All events" ? "observations" : category.toLowerCase() + " events"} for {recipientName} or the household in this period.</div>}</div>
    </section>
  </div>;
}
