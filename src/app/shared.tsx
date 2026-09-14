import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, BookOpen, Building2, Check, ChevronsUpDown, ChevronRight, CircleHelp, HeartHandshake, House, LogOut, Map, Menu, Pause, Play, Plus, Settings, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState(() => sessionStorage.getItem("one_care_recipient_id") ?? "");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);
  const [isCareToolsOpen, setIsCareToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [careSpaceMenuOpen, setCareSpaceMenuOpen] = useState(false);
  const [createCareSpaceOpen, setCreateCareSpaceOpen] = useState(false);
  const [careSpaceName, setCareSpaceName] = useState("");
  const [careSetting, setCareSetting] = useState<"home" | "residence">("home");
  const [supportFocus, setSupportFocus] = useState<"general" | "mci">("general");
  const [careSpaceBusy, setCareSpaceBusy] = useState(false);
  const [careSpaceError, setCareSpaceError] = useState("");
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const recipientMenuRef = useRef<HTMLDivElement>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1100px)").matches);
  const hasBackendSession = !demoMode && Boolean(sessionStorage.getItem("one_access_token") && sessionStorage.getItem("one_home_id"));
  const careRecipientsQuery = useQuery({ queryKey: ["care-recipients"], queryFn: api.getCareRecipients, enabled: demoMode || hasBackendSession, retry: false });
  const careSpacesQuery = useQuery({ queryKey: ["care-spaces"], queryFn: api.getCareSpaces, enabled: demoMode || hasBackendSession, retry: false });
  const careRecipients = careRecipientsQuery.data ?? [];
  const selectedResident = careRecipients.find((person) => person.id === recipient) ?? careRecipients[0];
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
  useEffect(() => {
    const handle = (event: Event) => setRecipient((event as CustomEvent<string>).detail);
    window.addEventListener("one:care-recipient-change", handle);
    return () => window.removeEventListener("one:care-recipient-change", handle);
  }, []);
  const careRecipientChanged = (value: string) => {
    setRecipient(value);
    setRecipientMenuOpen(false);
    sessionStorage.setItem("one_care_recipient_id", value);
    window.dispatchEvent(new CustomEvent("one:care-recipient-change", { detail: value }));
  };
  const finishCareSpaceChange = async () => {
    setRecipient("");
    sessionStorage.removeItem("one_care_recipient_id");
    sessionStorage.removeItem("one_subject_user_id");
    setRecipientMenuOpen(false);
    setCareSpaceMenuOpen(false);
    setCreateCareSpaceOpen(false);
    setCareSpaceError("");
    await queryClient.invalidateQueries();
    nav("/dashboard", { replace: true });
  };
  const activateCareSpace = async (careSpaceId: string) => {
    if (careSpaceId === session?.home.id || careSpaceBusy) { setCareSpaceMenuOpen(false); return; }
    setCareSpaceBusy(true);
    setCareSpaceError("");
    try {
      await api.activateCareSpace(careSpaceId);
      await finishCareSpaceChange();
    } catch {
      setCareSpaceError("We could not switch care spaces. Your current household is still active.");
    } finally {
      setCareSpaceBusy(false);
    }
  };
  const createCareSpace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!careSpaceName.trim() || careSpaceBusy) return;
    setCareSpaceBusy(true);
    setCareSpaceError("");
    try {
      await api.createCareSpace({ name: careSpaceName.trim(), careSetting, supportFocus });
      setCareSpaceName("");
      setCareSetting("home");
      setSupportFocus("general");
      await finishCareSpaceChange();
    } catch {
      setCareSpaceError("We could not create that care space. Check the name and try again.");
    } finally {
      setCareSpaceBusy(false);
    }
  };
  useEffect(() => {
    setIsMenuOpen(false);
    setProfileMenuOpen(false);
    setRecipientMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeProfileMenu = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeProfileMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeProfileMenu);
    document.addEventListener("keydown", closeProfileMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeProfileMenu);
      document.removeEventListener("keydown", closeProfileMenuOnEscape);
    };
  }, [profileMenuOpen]);
  useEffect(() => {
    if (!recipientMenuOpen) return;
    const closeRecipientMenu = (event: PointerEvent) => {
      if (!recipientMenuRef.current?.contains(event.target as Node)) setRecipientMenuOpen(false);
    };
    const closeRecipientMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRecipientMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeRecipientMenu);
    document.addEventListener("keydown", closeRecipientMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeRecipientMenu);
      document.removeEventListener("keydown", closeRecipientMenuOnEscape);
    };
  }, [recipientMenuOpen]);
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
          <button
            className={`pause-button ${paused ? "is-paused" : ""}`}
            onClick={onTogglePause}
            aria-pressed={paused}
            aria-label={paused ? "Resume care" : "Pause care"}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            <span className="pause-button-label">{paused ? "Resume care" : "Pause care"}</span>
          </button>
          <div className="profile-menu-wrap" ref={profileMenuRef}>
            <button className="avatar profile-menu-trigger" aria-label={`Open profile menu for ${actorName}`} aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((value) => !value)}>{accountInitials}</button>
            {profileMenuOpen && <div className="profile-menu" role="menu" aria-label="Profile menu">
              <div className="profile-menu-account"><span className="avatar" aria-hidden="true">{accountInitials}</span><span><strong>{actorName}</strong><small>{roleLabel}</small></span></div>
              <div className="profile-menu-divider" />
              <button role="menuitem" onClick={() => { setProfileMenuOpen(false); nav("/dashboard/assistant"); }}><CircleHelp size={17} /><span>Help</span></button>
              <button role="menuitem" onClick={() => { setProfileMenuOpen(false); nav("/dashboard/account"); }}><Settings size={17} /><span>Settings</span></button>
              <div className="profile-menu-divider" />
              <button className="profile-menu-logout" role="menuitem" onClick={() => { setProfileMenuOpen(false); onLogout(); }}><LogOut size={17} /><span>Log out</span></button>
            </div>}
          </div>
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
        <div className={`drawer-home-card ${careSpaceMenuOpen ? "is-managing" : ""}`}>
          <button className="drawer-home-summary" aria-expanded={careSpaceMenuOpen} aria-controls="care-space-menu" onClick={() => { setRecipientMenuOpen(false); setCareSpaceMenuOpen((value) => !value); setCreateCareSpaceOpen(false); setCareSpaceError(""); }}>
            <div className="drawer-home-icon"><HeartHandshake size={18} /></div>
            <div className="drawer-home-copy"><span className="eyebrow">CARING FOR</span><strong>{homeName}</strong><span className="drawer-connection"><i className="status-dot" />{demoMode ? "Demo care space" : connectedLabel}</span></div>
            <ChevronsUpDown className="drawer-home-switch-icon" size={16} aria-hidden="true" />
          </button>
          <div className="recipient-switcher" ref={recipientMenuRef}>
            <span className="recipient-switcher-label">Care recipient</span>
            <button
              id="recipient-switcher"
              className="recipient-switcher-trigger"
              type="button"
              aria-label="Care recipient"
              aria-haspopup="listbox"
              aria-expanded={recipientMenuOpen}
              aria-controls="recipient-options"
              onClick={() => { setCareSpaceMenuOpen(false); setRecipientMenuOpen((value) => !value); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setCareSpaceMenuOpen(false);
                  setRecipientMenuOpen(true);
                }
              }}
            >
              <span>{residentName} · baseline</span>
              <ChevronRight className={recipientMenuOpen ? "recipient-chevron is-open" : "recipient-chevron"} size={15} aria-hidden="true" />
            </button>
            {recipientMenuOpen && <div id="recipient-options" className="recipient-options" role="listbox" aria-label="Care recipient options">
              {careRecipients.length ? careRecipients.map((person, index) => {
                const isSelected = recipient ? recipient === person.id : index === 0;
                return <button key={person.id} className={`recipient-option ${isSelected ? "is-selected" : ""}`} type="button" role="option" aria-selected={isSelected} onClick={() => careRecipientChanged(person.id)}>
                  <span>{person.display_name}</span><small>{person.room_label || person.relationship || "baseline"}</small>{isSelected && <Check size={15} aria-hidden="true" />}
                </button>;
              }) : <div className="recipient-option-empty">No care recipients yet. Add one in Family.</div>}
            </div>}
          </div>
          {careSpaceMenuOpen && <div id="care-space-menu" className="care-space-menu" role="dialog" aria-label="Manage care spaces">
            <div className="care-space-menu-heading"><span className="eyebrow">YOUR CARE SPACES</span><p>Choose which household or residence you’re managing.</p></div>
            <div className="care-space-options">
              {(careSpacesQuery.data ?? []).map((space) => {
                const isCurrent = space.id === session?.home.id;
                return <button key={space.id} className={`care-space-option ${isCurrent ? "is-current" : ""}`} onClick={() => void activateCareSpace(space.id)} disabled={careSpaceBusy}>
                  <span className="care-space-option-icon">{space.careSetting === "residence" ? <Building2 size={16} /> : <House size={16} />}</span>
                  <span className="care-space-option-copy"><strong>{space.name}</strong><small>{space.role === "admin" ? "Admin" : space.role === "caregiver" ? "Caregiver" : "Resident"} · {space.careSetting === "residence" ? "Residence" : "Household"}</small></span>
                  {isCurrent && <Check size={16} aria-label="Current care space" />}
                </button>;
              })}
            </div>
            {careSpacesQuery.isError && <p className="care-space-error" role="alert">Your other care spaces could not be loaded.</p>}
            {!createCareSpaceOpen ? <button className="care-space-add" onClick={() => setCreateCareSpaceOpen(true)}><Plus size={16} /> Add a care space</button> : <form className="care-space-create" onSubmit={createCareSpace}>
              <div className="care-space-create-heading"><strong>New care space</strong><button type="button" aria-label="Cancel new care space" onClick={() => setCreateCareSpaceOpen(false)}><X size={15} /></button></div>
              <label>Name<input value={careSpaceName} onChange={(event) => setCareSpaceName(event.target.value)} placeholder="e.g. Grandma’s home" maxLength={120} autoFocus /></label>
              <label>Setting<select value={careSetting} onChange={(event) => setCareSetting(event.target.value as "home" | "residence")}><option value="home">Private household</option><option value="residence">Care residence</option></select></label>
              <label>Support focus<select value={supportFocus} onChange={(event) => setSupportFocus(event.target.value as "general" | "mci")}><option value="general">General daily support</option><option value="mci">MCI-oriented routine support</option></select></label>
              <button className="primary-button care-space-create-submit" type="submit" disabled={!careSpaceName.trim() || careSpaceBusy}>{careSpaceBusy ? "Creating…" : "Create & switch"}</button>
            </form>}
            {careSpaceError && <p className="care-space-error" role="alert">{careSpaceError}</p>}
          </div>}
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
      </aside>
    </div>
  );
}
