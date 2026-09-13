import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, BookOpen, ChevronRight, CircleHelp, HeartHandshake, House, LogOut, Map, Menu, Pause, Play, Settings, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, demoMode } from "../api/client";
import type { HomeEvent, LastSeenObject, Session } from "../models/domain";

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

export function Shell({ children, paused, onTogglePause, onLogout, session }: { children: React.ReactNode; paused: boolean; onTogglePause: () => void; onLogout: () => void; session?: Session }) {
  const location = useLocation();
  const nav = useNavigate();
  const [recipient, setRecipient] = useState(() => sessionStorage.getItem("one_subject_user_id") ?? "");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCareToolsOpen, setIsCareToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1100px)").matches);
  const hasBackendSession = !demoMode && Boolean(sessionStorage.getItem("one_access_token") && sessionStorage.getItem("one_home_id"));
  const familyMembersQuery = useQuery({ queryKey: ["family-members"], queryFn: api.getFamilyMembers, enabled: hasBackendSession, retry: false });
  const residents = (familyMembersQuery.data ?? []).filter((member) => member.role === "resident");
  const selectedResident = residents.find((member) => member.id === recipient);
  const actorName = session?.actor.name ?? (demoMode ? "Clara García" : "Your account");
  const homeName = session?.home.name ?? (demoMode ? "The García home" : "Your care space");
  const residentName = selectedResident?.display_name ?? session?.home.residentName ?? (demoMode ? "María" : "Resident");
  const accountInitials = actorName.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ONE";
  const roleLabel = session?.actor.role === "admin" ? "Admin account" : session?.actor.role === "resident" ? "Resident account" : session?.actor.role === "caregiver" ? "Caregiver account" : "ONE account";
  const connectedLabel = session?.home.careSetting === "residence" ? "Connected residence" : "Connected household";
  const primaryItems = [
    { to: "/dashboard", label: "Overview", icon: House },
    { to: "/dashboard/live", label: "Today’s check-in", icon: HeartHandshake },
    { to: "/dashboard/map", label: "Home map", icon: Map },
    { to: "/dashboard/events", label: "Events", icon: Activity },
  ];
  const careItems = [
    { to: "/dashboard/assistant", label: "Assistant", icon: Sparkles },
    { to: "/dashboard/family", label: "Family", icon: Users },
  ];
  const subjectChanged = (value: string) => {
    setRecipient(value);
    sessionStorage.setItem("one_subject_user_id", value);
    window.dispatchEvent(new CustomEvent("one:subject-change", { detail: value }));
  };
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", isMenuOpen);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [isMenuOpen]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(min-width: 1100px)");
    const updateScreenSize = () => setIsLargeScreen(mediaQuery.matches);
    updateScreenSize();
    mediaQuery.addEventListener?.("change", updateScreenSize);
    return () => mediaQuery.removeEventListener?.("change", updateScreenSize);
  }, []);
  const closeMenu = () => setIsMenuOpen(false);
  const isActive = (to: string) => to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(to);
  const renderNavLink = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof House }) => (
    <NavLink key={to} to={to} end={to === "/dashboard"} className={`drawer-item ${isActive(to) ? "active" : ""}`} onClick={closeMenu}>
      <Icon size={18} strokeWidth={1.8} />
      <span>{label}</span>
      {label === "Events" && <span className="nav-badge">3</span>}
    </NavLink>
  );
  const context = location.pathname.includes("map")
    ? ["HOME MAP", "See the familiar places"]
    : location.pathname.includes("live")
      ? ["TODAY'S CHECK-IN", `Be here with ${residentName}`]
    : location.pathname.includes("events")
      ? ["EVENTS", "A gentle timeline"]
      : location.pathname.includes("assistant")
        ? ["RESIDENT ASSISTANT", `Ask about ${residentName}’s day`]
        : location.pathname.includes("family")
          ? ["FAMILY MODE", "Care together, clearly"]
          : location.pathname.includes("account")
            ? ["ACCOUNT", "Your ONE account"]
            : [`GOOD MORNING, ${actorName.split(/\s+/)[0]?.toUpperCase() || "THERE"}`, homeName];
  return (
    <div className="app-shell">
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-brandline">
            <button className="brand" onClick={() => nav("/dashboard")} aria-label="ONE home"><img className="one-logo" src="/one-logo.png" alt="" aria-hidden="true" /><span className="wordmark">ONE</span></button>
            <span className="topbar-divider" aria-hidden="true" />
            <div className="topbar-context"><span className="eyebrow">{context[0]}</span><h1>{context[1]}</h1></div>
          </div>
          <div className="top-actions">
          <button className={`pause-button ${paused ? "is-paused" : ""}`} onClick={onTogglePause} aria-pressed={paused}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume care" : "Pause care"}</button>
          <button className="icon-button" aria-label="Help"><CircleHelp size={20} /></button>
          <button className="icon-button account-shortcut" aria-label="Account settings" onClick={() => nav("/dashboard/account")}><Settings size={18} /></button>
          <button className="avatar" aria-label={`Sign out ${actorName}`} onClick={onLogout}>{accountInitials}</button>
          <button className="menu-trigger" aria-controls="one-navigation-drawer" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((value) => !value)}><span>{isMenuOpen ? "Close" : "Menu"}</span>{isMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          </div>
        </header>
        {paused && <div className="paused-banner" role="status"><Pause size={18} /><div><strong>Care is paused</strong><span>No camera or microphone is active. Resume when {residentName} is ready.</span></div><button onClick={onTogglePause}>Resume</button></div>}
        <div className="page-wrap">{children}</div>
      </main>
      {isMenuOpen && <button className="drawer-scrim" aria-label="Close navigation" onClick={closeMenu} />}
      <aside id="one-navigation-drawer" className={`care-drawer ${isMenuOpen ? "is-open" : ""}`} aria-label="ONE care navigation" aria-hidden={isLargeScreen ? undefined : !isMenuOpen}>
        <button className="drawer-brand" onClick={() => nav("/dashboard")} aria-label="ONE home"><img className="one-logo" src="/one-logo.png" alt="" aria-hidden="true" /><span className="wordmark">ONE</span></button>
        <button className="drawer-close icon-button" aria-label="Close navigation" onClick={closeMenu}><X size={18} /></button>
        <div className="drawer-home-card">
          <div className="drawer-home-icon"><HeartHandshake size={18} /></div>
          <div className="drawer-home-copy"><span className="eyebrow">CARING FOR</span><strong>{homeName}</strong><span>{hasBackendSession ? connectedLabel : "Demo household"}</span></div>
          <select id="recipient-switcher" aria-label="Care recipient" value={recipient} onChange={(e) => subjectChanged(e.target.value)}>
            <option value="">{hasBackendSession ? `${session?.home.residentName ?? "Resident"} · baseline` : "María · Baseline"}</option>
            {residents.map((member) => <option key={member.id} value={member.id}>{member.display_name} · baseline</option>)}
          </select>
        </div>
        <nav className="drawer-nav" aria-label="Care dashboard">
          <span className="drawer-section-label">Care dashboard</span>
          {primaryItems.map(renderNavLink)}
          <div className="drawer-divider" />
          <button className="drawer-group-toggle" aria-controls="care-together-submenu" aria-expanded={isCareToolsOpen} onClick={() => setIsCareToolsOpen((value) => !value)}><span><BookOpen size={18} strokeWidth={1.8} />Care together</span><ChevronRight className={isCareToolsOpen ? "rotated" : ""} size={17} /></button>
          {isCareToolsOpen && <div id="care-together-submenu" className="drawer-group-items" role="group" aria-label="Care together links">{careItems.map(renderNavLink)}</div>}
          <button className="drawer-group-toggle" aria-controls="safety-settings-submenu" aria-expanded={isSettingsOpen} onClick={() => setIsSettingsOpen((value) => !value)}><span><ShieldCheck size={18} strokeWidth={1.8} />Safety & settings</span><ChevronRight className={isSettingsOpen ? "rotated" : ""} size={17} /></button>
          {isSettingsOpen && <div id="safety-settings-submenu" className="drawer-group-items" role="group" aria-label="Safety and settings links">{renderNavLink({ to: "/dashboard/privacy", label: "Privacy & consent", icon: ShieldCheck })}{renderNavLink({ to: "/dashboard/account", label: "Account settings", icon: Settings })}</div>}
        </nav>
        <div className="drawer-footer">
          <div className="drawer-account"><span className="avatar">{accountInitials}</span><span><strong>{actorName}</strong><small>{roleLabel}</small></span><button aria-label={`Sign out ${actorName}`} onClick={onLogout}><LogOut size={17} /></button></div>
        </div>
      </aside>
    </div>
  );
}
