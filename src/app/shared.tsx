import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, ChevronRight, CircleHelp, LayoutDashboard, Map, Pause, Play, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, demoMode } from "../api/client";
import type { HomeEvent, LastSeenObject } from "../models/domain";

export const formatTime = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(date))
    : "Not located";

export function EventRow({ event, onClick }: { event: HomeEvent; onClick?: () => void }) {
  return (
    <button className="event-row" onClick={onClick}>
      <span className={`event-icon ${event.tone}`}>
        {event.type === "object.last_seen" ? "⌁" : event.type === "clip.created" ? "▶" : "✦"}
      </span>
      <span className="event-copy"><strong>{event.title}</strong><span>{event.detail}</span></span>
      <time>{formatTime(event.occurredAt)}</time>
      <ChevronRight size={16} />
    </button>
  );
}

export function ObjectCard({ object, onClick }: { object: LastSeenObject; onClick?: () => void }) {
  return (
    <button className="object-card" onClick={onClick}>
      <span className="object-symbol">{object.icon}</span>
      <span><strong>{object.label}</strong><span className="muted">{object.zone?.name ?? "Location unknown"}</span></span>
      <span className={`confidence ${object.status === "unknown" ? "low" : ""}`}>{Math.round(object.confidence * 100)}%</span>
    </button>
  );
}

export function Shell({ children, paused, onTogglePause, onLogout }: { children: React.ReactNode; paused: boolean; onTogglePause: () => void; onLogout: () => void }) {
  const location = useLocation();
  const nav = useNavigate();
  const [recipient, setRecipient] = useState(() => sessionStorage.getItem("one_subject_user_id") ?? "");
  const hasBackendSession = !demoMode && Boolean(sessionStorage.getItem("one_access_token") && sessionStorage.getItem("one_home_id"));
  const familyMembersQuery = useQuery({ queryKey: ["family-members"], queryFn: api.getFamilyMembers, enabled: hasBackendSession, retry: false });
  const items = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/dashboard/map", label: "Home map", icon: Map },
    { to: "/dashboard/events", label: "Events", icon: Activity },
    { to: "/dashboard/assistant", label: "Assistant", icon: Sparkles },
    { to: "/dashboard/family", label: "Family", icon: Users },
  ];
  const subjectChanged = (value: string) => {
    setRecipient(value);
    sessionStorage.setItem("one_subject_user_id", value);
    window.dispatchEvent(new CustomEvent("one:subject-change", { detail: value }));
  };
  const context = location.pathname.includes("map")
    ? ["HOME MAP", "See the familiar places"]
    : location.pathname.includes("events")
      ? ["EVENTS", "A gentle timeline"]
      : location.pathname.includes("assistant")
        ? ["RESIDENT ASSISTANT", "Ask about María’s day"]
        : location.pathname.includes("family")
          ? ["FAMILY MODE", "Care together, clearly"]
          : location.pathname.includes("account")
            ? ["ACCOUNT", "Your ONE account"]
            : ["GOOD MORNING, CLARA", "The García home"];
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand" onClick={() => nav("/dashboard")} aria-label="ONE home"><span className="brand-mark">O</span><span>ONE</span></button>
        <div className="home-switcher">
          <span className="eyebrow">CARING FOR</span><strong>The García home</strong>
          <label className="muted" htmlFor="recipient-switcher">Care recipient</label>
          <select id="recipient-switcher" aria-label="Care recipient" value={recipient} onChange={(e) => subjectChanged(e.target.value)}>
            <option value="">{hasBackendSession ? "My care view" : "María · Personal baseline"}</option>
            {(familyMembersQuery.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.role}</option>)}
          </select>
          {hasBackendSession && !familyMembersQuery.data?.length && <span className="muted">Enable family sharing in onboarding or Family mode to choose another person.</span>}
        </div>
        <nav className="nav-list">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Icon size={18} /><span>{label}</span>{label === "Events" && <span className="nav-badge">3</span>}</NavLink>)}</nav>
        <div className="sidebar-bottom">
          <NavLink to="/dashboard/privacy" className="nav-item"><ShieldCheck size={18} /><span>Privacy & consent</span></NavLink>
          <NavLink to="/dashboard/account" className="nav-item"><Settings size={18} /><span>Account settings</span></NavLink>
          <div className="connection-pill"><span className="status-dot" /> Local network · {demoMode ? "Demo" : "Connected"}</div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><span className="eyebrow">{context[0]}</span><h1>{context[1]}</h1></div><div className="top-actions">
          <button className={`pause-button ${paused ? "is-paused" : ""}`} onClick={onTogglePause} aria-pressed={paused}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume care" : "Pause care"}</button>
          <button className="icon-button" aria-label="Help"><CircleHelp size={20} /></button>
          <button className="icon-button account-shortcut" aria-label="Account settings" onClick={() => nav("/dashboard/account")}><Settings size={18} /></button>
          <button className="avatar" aria-label="Sign out" onClick={onLogout}>CG</button>
        </div></header>
        {paused && <div className="paused-banner" role="status"><Pause size={18} /><div><strong>Care is paused</strong><span>No camera or microphone is active. Resume when María is ready.</span></div><button onClick={onTogglePause}>Resume</button></div>}
        <div className="page-wrap">{children}</div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
    </div>
  );
}
