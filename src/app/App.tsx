import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
  Camera,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  LockKeyhole,
  Map,
  MessageCircle,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, clearSession, demoMode, type FamilyMember } from "../api/client";
import { consentDefaults, demoEvents, demoObjects } from "../demo/data";
import type {
  Consent,
  HomeEvent,
  LastSeenObject,
  Scene,
} from "../models/domain";
import type { PublisherConnection } from "../livekit/publisher";
import { demoScene } from "../demo/data";
import { streamHomeEvents } from "../api/sse";
import {
  clearPublisherRegistry,
  registerPublisherConnection,
  registerPublisherStream,
  stopActivePublisher,
} from "../livekit/registry";
const RoomScene3D = lazy(() =>
  import("../map/RoomScene3D").then((module) => ({
    default: module.RoomScene3D,
  })),
);

const formatTime = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(date))
    : "Not located";

function Shell({
  children,
  paused,
  onTogglePause,
  onLogout,
}: {
  children: React.ReactNode;
  paused: boolean;
  onTogglePause: () => void;
  onLogout: () => void;
}) {
  const location = useLocation();
  const nav = useNavigate();
  const [recipient, setRecipient] = useState(() => sessionStorage.getItem('one_subject_user_id') ?? '');
  const hasBackendSession = !demoMode && Boolean(sessionStorage.getItem('one_access_token') && sessionStorage.getItem('one_home_id'));
  const familyMembersQuery = useQuery({
    queryKey: ['family-members'],
    queryFn: api.getFamilyMembers,
    enabled: hasBackendSession,
    retry: false,
  });
  const items = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/dashboard/map", label: "Home map", icon: Map },
    { to: "/dashboard/events", label: "Events", icon: Activity },
    { to: "/dashboard/assistant", label: "Assistant", icon: Sparkles },
    { to: "/dashboard/family", label: "Family", icon: Users },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button
          className="brand"
          onClick={() => nav("/dashboard")}
          aria-label="ONE home"
        >
          <span className="brand-mark">O</span>
          <span>ONE</span>
        </button>
        <div className="home-switcher">
          <span className="eyebrow">CARING FOR</span>
          <strong>The García home</strong>
          <label className="muted" htmlFor="recipient-switcher">Care recipient</label>
          <select id="recipient-switcher" aria-label="Care recipient" value={recipient} onChange={(e) => { const value = e.target.value; setRecipient(value); sessionStorage.setItem('one_subject_user_id', value); window.dispatchEvent(new CustomEvent('one:subject-change', { detail: value })); }}>
            <option value="">{hasBackendSession ? 'My care view' : 'María · Personal baseline'}</option>
            {(familyMembersQuery.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.display_name} · {member.role}</option>)}
          </select>
          {hasBackendSession && !familyMembersQuery.data?.length && <span className="muted">Enable family sharing in onboarding or Family mode to choose another person.</span>}
        </div>
        <nav className="nav-list">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Events" && <span className="nav-badge">3</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/dashboard/privacy" className="nav-item">
            <ShieldCheck size={18} />
            <span>Privacy & consent</span>
          </NavLink>
          <div className="connection-pill">
            <span className="status-dot" /> Local network ·{" "}
            {demoMode ? "Demo" : "Connected"}
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              {location.pathname.includes("map")
                ? "HOME MAP"
                : location.pathname.includes("events")
                  ? "EVENTS"
                  : location.pathname.includes("assistant")
                    ? "RESIDENT ASSISTANT"
                    : location.pathname.includes("family")
                      ? "FAMILY MODE"
                      : "GOOD MORNING, CLARA"}
            </span>
            <h1>
              {location.pathname.includes("map")
                ? "See the familiar places"
                : location.pathname.includes("events")
                  ? "A gentle timeline"
                  : location.pathname.includes("assistant")
                    ? "Ask about María’s day"
                    : location.pathname.includes("family")
                      ? "Care together, clearly"
                      : "The García home"}
            </h1>
          </div>
          <div className="top-actions">
            <button
              className={`pause-button ${paused ? "is-paused" : ""}`}
              onClick={onTogglePause}
              aria-pressed={paused}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? "Resume care" : "Pause care"}
            </button>
            <button className="icon-button" aria-label="Help">
              <CircleHelp size={20} />
            </button>
            <button className="avatar" aria-label="Sign out" onClick={onLogout}>
              CG
            </button>
          </div>
        </header>
        {paused && (
          <div className="paused-banner" role="status">
            <Pause size={18} />
            <div>
              <strong>Care is paused</strong>
              <span>
                No camera or microphone is active. Resume when María is ready.
              </span>
            </div>
            <button onClick={onTogglePause}>Resume</button>
          </div>
        )}
        <div className="page-wrap">{children}</div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function EventRow({
  event,
  onClick,
}: {
  event: HomeEvent;
  onClick?: () => void;
}) {
  return (
    <button className="event-row" onClick={onClick}>
      <span className={`event-icon ${event.tone}`}>
        {event.type === "object.last_seen"
          ? "⌁"
          : event.type === "clip.created"
            ? "▶"
            : "✦"}
      </span>
      <span className="event-copy">
        <strong>{event.title}</strong>
        <span>{event.detail}</span>
      </span>
      <time>{formatTime(event.occurredAt)}</time>
      <ChevronRight size={16} />
    </button>
  );
}
function ObjectCard({
  object,
  onClick,
}: {
  object: LastSeenObject;
  onClick?: () => void;
}) {
  return (
    <button className="object-card" onClick={onClick}>
      <span className="object-symbol">{object.icon}</span>
      <span>
        <strong>{object.label}</strong>
        <span className="muted">{object.zone?.name ?? "Location unknown"}</span>
      </span>
      <span
        className={`confidence ${object.status === "unknown" ? "low" : ""}`}
      >
        {Math.round(object.confidence * 100)}%
      </span>
    </button>
  );
}

function Dashboard({
  events,
  objects,
  onEvent,
}: {
  events: HomeEvent[];
  objects: LastSeenObject[];
  onEvent: (e: HomeEvent) => void;
}) {
  const nav = useNavigate();
  return (
    <div className="home-page">
      <section className="home-intro">
        <span className="eyebrow">ONE · THE GARCÍA HOME</span>
        <h2>
          A little support.
          <br />A more independent day.
        </h2>
        <p>
          Stay close to what matters with gentle, explainable observations from
          home.
        </p>
      </section>
      <section className="pairing-card">
        <div>
          <span className="eyebrow">CAMERA CONNECTION</span>
          <h3>Bring one more set of eyes into the room.</h3>
          <p>
            Pair a phone or laptop camera in under a minute. Consent comes
            before anything is shared.
          </p>
        </div>
        <button className="primary-button" onClick={() => nav("/join")}>
          <Camera size={17} /> Pair a camera <ChevronRight size={16} />
        </button>
      </section>
      <div className="status-chips" aria-label="Home status filters">
        <button className="chip active">
          <span className="status-dot" />
          All home
        </button>
        <button className="chip">Calm today</button>
        <button className="chip">3 observations</button>
        <button className="chip">Camera online</button>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECENT OBSERVATIONS</span>
            <h3>Small moments, kept meaningful.</h3>
          </div>
          <button
            className="text-button"
            onClick={() => nav("/dashboard/events")}
          >
            See all <ChevronRight size={15} />
          </button>
        </div>
        <div className="observation-grid">
          {events.slice(0, 3).map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onClick={() => onEvent(event)}
            />
          ))}
        </div>
      </section>
      <section className="household-card">
        <div>
          <span className="eyebrow">HOUSEHOLD PLAN · TODAY</span>
          <h3>Morning check-in is complete.</h3>
          <p>
            María answered 4 of 4 prompts at 08:42. Her signal is within her
            personal baseline.
          </p>
        </div>
        <div className="plan-status">
          <strong>4 / 4</strong>
          <span>calm check-in</span>
          <div className="progress-line">
            <span />
          </div>
        </div>
        <button
          className="secondary-button"
          onClick={() => nav("/dashboard/assistant")}
        >
          Explore context <ChevronRight size={16} />
        </button>
      </section>
      <section className="home-section memory-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">OBJECT MEMORY</span>
            <h3>Where things were last seen</h3>
          </div>
          <button className="text-button" onClick={() => nav("/dashboard/map")}>
            Open map <Map size={15} />
          </button>
        </div>
        <div className="object-list">
          {objects.map((object) => (
            <ObjectCard
              key={object.id}
              object={object}
              onClick={() => nav("/dashboard/map")}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MapPage({
  objects,
  scene,
}: {
  objects: LastSeenObject[];
  scene: Scene;
}) {
  const [selected, setSelected] = useState(objects[0]?.id);
  const [view, setView] = useState<"3d" | "2d">("3d");
  const current = objects.find((o) => o.id === selected);
  return (
    <div className="map-layout">
      <section className="map-panel panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ROOMPLAN-DERIVED VIEW · v3</span>
            <h2>Familiar places, gently remembered.</h2>
          </div>
          <div className="view-toggle">
            <button
              className={view === "3d" ? "active" : ""}
              onClick={() => setView("3d")}
            >
              3D
            </button>
            <button
              className={view === "2d" ? "active" : ""}
              onClick={() => setView("2d")}
            >
              2D
            </button>
          </div>
        </div>
        <div className="scene-wrap">
          {view === "3d" ? (
            <Suspense
              fallback={
                <div className="three-scene loading-scene">
                  Loading room view…
                </div>
              }
            >
              <RoomScene3D
                scene={scene}
                objects={objects}
                selectedId={selected}
                onSelect={setSelected}
              />
            </Suspense>
          ) : (
            <div
              className="scene-grid"
              aria-label="2D accessible floor plan fallback"
            >
              <div className="scene-label living-label">LIVING ROOM</div>
              <div className="scene-label entry-label">ENTRYWAY</div>
              <div className="scene-label kitchen-label">KITCHEN</div>
              <div className="scene-label bedroom-label">BEDROOM</div>
              {objects
                .filter((o) => o.point)
                .map((object) => (
                  <button
                    key={object.id}
                    className={`map-marker ${selected === object.id ? "selected" : ""}`}
                    style={{
                      left: `${object.point!.x}%`,
                      top: `${object.point!.y}%`,
                    }}
                    onClick={() => setSelected(object.id)}
                    aria-label={`${object.label}, ${object.zone?.name ?? "location unknown"}`}
                  >
                    <span>{object.icon}</span>
                  </button>
                ))}
              <span className="camera-frustum" aria-hidden="true">
                <Camera size={13} /> camera
              </span>
            </div>
          )}
          <div className="scene-legend">
            <span>
              <i className="legend-dot precise" /> Estimated point
            </span>
            <span>
              <i className="legend-dot zone" /> Zone fallback
            </span>
            <span>
              {view === "3d"
                ? "Drag-free overview · select a marker"
                : "Scale · 1 square = 1m"}
            </span>
          </div>
        </div>
      </section>
      <aside className="map-side">
        <div className="panel selected-object">
          <span className="eyebrow">SELECTED MEMORY</span>
          {current ? (
            <>
              <div className="selected-title">
                <span className="object-symbol">{current.icon}</span>
                <div>
                  <h2>{current.label}</h2>
                  <span className="muted">
                    Last seen {formatTime(current.lastSeenAt)}
                  </span>
                </div>
              </div>
              <div className="confidence-meter">
                <div>
                  <span>Confidence</span>
                  <strong>{Math.round(current.confidence * 100)}%</strong>
                </div>
                <div className="meter">
                  <span style={{ width: `${current.confidence * 100}%` }} />
                </div>
                <p>
                  {current.point
                    ? `Estimated within ${current.confidenceRadiusM}m of this point.`
                    : `Point is uncertain; showing the ${current.zone?.name ?? "nearest"} zone instead.`}
                </p>
              </div>
              <button className="secondary-button full-width">
                <Video size={16} /> View source clip
              </button>
            </>
          ) : (
            <p className="muted">Select an object on the map.</p>
          )}
        </div>
        <div className="panel calibration-card">
          <span className="eyebrow">FIXED CAMERA</span>
          <h3>Camera coverage is good</h3>
          <p className="muted">Calibrated 2 days ago · estimated error 0.18m</p>
          <button className="text-button">
            Review calibration <ChevronRight size={15} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function EventsPage({
  events,
  onEvent,
}: {
  events: HomeEvent[];
  onEvent: (e: HomeEvent) => void;
}) {
  return (
    <div className="events-page">
      <div className="filter-row">
        <button className="filter active">All moments</button>
        <button className="filter">Objects</button>
        <button className="filter">Check-ins</button>
        <button className="filter">Clips</button>
        <span className="filter-spacer" />
        <button className="icon-button" aria-label="Filter events">
          <Activity size={17} />
        </button>
      </div>
      <section className="panel timeline-panel">
        <div className="timeline-date">
          <span>Today</span>
          <span className="muted">September 12, 2026</span>
        </div>
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onClick={() => onEvent(event)}
          />
        ))}
        <div className="timeline-date older">
          <span>Yesterday</span>
          <span className="muted">September 11, 2026</span>
        </div>
        <div className="empty-event">
          Earlier moments are kept brief and purposeful.
        </div>
      </section>
    </div>
  );
}

function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "one",
      text: "Good morning, Clara. I can help you understand what ONE observed — gently and with context.",
    },
  ]);
  const ask = () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setMessages((m) => [
      ...m,
      { from: "you", text: q },
      {
        from: "one",
        text: q.toLowerCase().includes("key")
          ? "The keys were last observed 18 minutes ago near the entryway console. The estimate has a confidence radius of 0.8m."
          : "I found a calm morning check-in and no urgent changes from María’s personal baseline. Would you like to explore a specific moment?",
      },
    ]);
  };
  return (
    <div className="assistant-layout">
      <section className="assistant-card panel">
        <div className="assistant-intro">
          <span className="assistant-spark">
            <Sparkles size={20} />
          </span>
          <div>
            <span className="eyebrow">ONE ASSISTANT</span>
            <h2>Context, not conclusions.</h2>
            <p>
              Ask about observations and moments from María’s day. Answers
              always link back to evidence.
            </p>
          </div>
        </div>
        <div className="chat-log" aria-live="polite">
          {messages.map((m, i) => (
            <div className={`chat-bubble ${m.from}`} key={`${m.from}-${i}`}>
              {m.text}
              {m.from === "one" && i > 0 && (
                <small>Based on observed events · Not a diagnosis</small>
              )}
            </div>
          ))}
        </div>
        <div className="assistant-input">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Try: Where were the keys last seen?"
            aria-label="Ask ONE assistant"
          />
          <button className="primary-button" onClick={ask}>
            <MessageCircle size={16} /> Ask ONE
          </button>
        </div>
      </section>
      <aside className="suggestion-panel">
        <span className="eyebrow">TRY ASKING</span>
        {[
          "Where were the keys last seen?",
          "How did the morning check-in go?",
          "What changed from yesterday?",
        ].map((q) => (
          <button key={q} onClick={() => setQuestion(q)}>
            {q}
            <ChevronRight size={15} />
          </button>
        ))}
        <div className="assistant-note">
          <ShieldCheck size={17} />
          <span>
            ONE explains observations. It does not diagnose or make emergency
            decisions.
          </span>
        </div>
      </aside>
    </div>
  );
}

function LivePage() {
  return (
    <div className="live-page">
      <section className="panel live-viewer">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CAREGIVER VIEWER · LIVEKIT</span>
            <h2>Hallway camera</h2>
          </div>
          <span className="live-chip">
            <span className="status-dot" /> Connected
          </span>
        </div>
        <div className="viewer-placeholder">
          <Video size={31} />
          <strong>Live view is ready</strong>
          <span>
            Demo mode shows a privacy-safe placeholder. The backend-issued
            LiveKit token attaches here.
          </span>
        </div>
        <div className="viewer-controls">
          <span className="muted">
            <LockKeyhole size={14} /> Encrypted in transit
          </span>
          <span className="muted">Hallway iPhone · Online</span>
        </div>
      </section>
      <aside className="panel live-note">
        <span className="eyebrow">A HUMAN MOMENT</span>
        <h3>Watch with context.</h3>
        <p className="muted">
          ONE keeps the live view purposeful. Meaningful events and object
          memory stay available when you do not need to watch.
        </p>
      </aside>
    </div>
  );
}

function CalibrationPage() {
  const [step, setStep] = useState(0);
  const steps = [
    "Place the camera in its fixed spot.",
    "Point at the left floor marker.",
    "Point at the center floor marker.",
    "Point at the right floor marker.",
  ];
  const done = step >= steps.length;
  return (
    <div className="calibration-layout">
      <section className="panel calibration-main">
        <span className="eyebrow">FIXED CAMERA CALIBRATION</span>
        <h2>{done ? "Coverage looks good." : "Make this view familiar."}</h2>
        <p className="muted">
          ONE uses three simple anchors to estimate where observations sit in
          the room. You can review this later.
        </p>
        <div className="calibration-preview">
          <span className="crosshair">+</span>
          <span className="calibration-instruction">
            {done ? "Camera calibrated · estimated error 0.18m" : steps[step]}
          </span>
        </div>
        <div className="calibration-progress">
          <span
            style={{ width: `${Math.min(100, (step / steps.length) * 100)}%` }}
          />
        </div>
        <div className="calibration-actions">
          {!done && (
            <button
              className="primary-button"
              onClick={() => setStep((value) => value + 1)}
            >
              {step === 0 ? "Start calibration" : "Confirm anchor"}{" "}
              <ChevronRight size={16} />
            </button>
          )}
          {done && (
            <button
              className="primary-button"
              onClick={() => window.location.assign("/publisher/live")}
            >
              Continue to publisher <ChevronRight size={16} />
            </button>
          )}
          <span className="muted">
            Step {Math.min(step + 1, steps.length)} of {steps.length}
          </span>
        </div>
      </section>
      <aside className="panel calibration-help">
        <span className="eyebrow">WHY THIS MATTERS</span>
        <h3>Approximate, never overconfident.</h3>
        <p className="muted">
          When a point is uncertain, the caregiver sees a zone and a confidence
          radius instead of a false precision.
        </p>
      </aside>
    </div>
  );
}

function PrivacyPage({
  paused,
  onTogglePause,
  consents,
  setConsents,
}: {
  paused: boolean;
  onTogglePause: () => void;
  consents: Consent[];
  setConsents: (c: Consent[]) => void;
}) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const run = async (kind: "export" | "delete") => {
    if (
      kind === "delete" &&
      !window.confirm(
        "Delete the home’s stored clips and observations? This cannot be undone.",
      )
    )
      return;
    setBusy(kind);
    setNotice("");
    setError("");
    try {
      const result =
        kind === "export" ? await api.exportData() : await api.deleteData();
      const status =
        typeof result === "object" && result && "status" in result
          ? String(result.status)
          : "accepted";
      setNotice(
        kind === "export"
          ? `Export request ${status}.`
          : `Deletion request ${status}.`,
      );
    } catch {
      setError(
        kind === "export"
          ? "The export could not be requested. Nothing was downloaded."
          : "The deletion request could not be submitted. No data was deleted.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="privacy-layout">
      <section className="panel privacy-main">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">GDPR CONTROLS</span>
            <h2>Your data, your say.</h2>
          </div>
          <LockKeyhole size={22} className="muted" />
        </div>
        <p className="intro-copy">
          ONE is designed around consent. Change a purpose at any time; pausing
          care stops the camera immediately.
        </p>
        <div className="consent-list">
          {consents.map((consent) => (
            <label className="consent-row" key={consent.purpose}>
              <span>
                <strong>{consent.label}</strong>
                <span>{consent.description}</span>
              </span>
              <input
                type="checkbox"
                checked={consent.granted}
                onChange={() =>
                  setConsents(
                    consents.map((c) =>
                      c.purpose === consent.purpose
                        ? { ...c, granted: !c.granted }
                        : c,
                    ),
                  )
                }
              />
              <span className="toggle" aria-hidden="true" />
            </label>
          ))}
        </div>
        <div className="privacy-actions">
          <button
            className={`secondary-button ${paused ? "resume-action" : "pause-action"}`}
            onClick={onTogglePause}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? "Resume care" : "Pause camera & microphone"}
          </button>
          <p className="muted">Pause is always available from the top bar.</p>
        </div>
        {notice && (
          <div className="success-note" role="status">
            <ShieldCheck size={17} />
            {notice}
          </div>
        )}
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
      </section>
      <aside className="privacy-side">
        <div className="panel action-card">
          <span className="eyebrow">YOUR RIGHT TO ACCESS</span>
          <h3>Export your data</h3>
          <p className="muted">
            Receive observations, consent history, and stored clips in a
            portable package.
          </p>
          <button
            className="text-button"
            onClick={() => run("export")}
            disabled={busy !== null}
          >
            {busy === "export" ? (
              "Requesting…"
            ) : (
              <>
                Request export <ChevronRight size={15} />
              </>
            )}
          </button>
        </div>
        <div className="panel action-card danger-card">
          <span className="eyebrow">YOUR RIGHT TO ERASURE</span>
          <h3>Delete home data</h3>
          <p className="muted">
            Permanently remove stored clips and observations from this home.
          </p>
          <button
            className="text-button danger"
            onClick={() => run("delete")}
            disabled={busy !== null}
          >
            {busy === "delete" ? (
              "Submitting…"
            ) : (
              <>
                Request deletion <ChevronRight size={15} />
              </>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}

function PublisherPage({
  paused,
  onTogglePause,
}: {
  paused: boolean;
  onTogglePause: () => void;
}) {
  const [consented, setConsented] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connection, setConnection] = useState<PublisherConnection | null>(
    null,
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const videoRef = (node: HTMLVideoElement | null) => {
    if (node && stream) node.srcObject = stream;
  };
  const stop = () => {
    stopActivePublisher();
    setStream(null);
    setConnection(null);
  };
  const togglePublisher = () => {
    if (!paused) stop();
    onTogglePause();
  };
  const start = async () => {
    if (starting || stream || !consented) return;
    setStarting(true);
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      registerPublisherStream(media);
      setStream(media);
      if (!demoMode) {
        const livekit = await api.getLiveKitToken("publish");
        if (livekit.url && livekit.token) {
          const { connectPublisher } = await import("../livekit/publisher");
          const liveConnection = await connectPublisher(
            livekit.url,
            livekit.token,
          );
          registerPublisherConnection(liveConnection.disconnect);
          setConnection(liveConnection);
        }
      }
    } catch {
      stopActivePublisher();
      setStream(null);
      setConnection(null);
      setError(
        "Camera or microphone permission was not granted, or the LiveKit room was unavailable. You can retry safely.",
      );
    } finally {
      setStarting(false);
    }
  };
  useEffect(
    () => () => {
      stopActivePublisher();
      clearPublisherRegistry();
    },
    [],
  );
  return (
    <div className="publisher-layout">
      <section className="panel publisher-card">
        <div className="publisher-heading">
          <span className="eyebrow">PUBLISHER MODE · HALLWAY IPHONE</span>
          <h2>Be the calm in the room.</h2>
          <p>
            Place this device in its fixed spot. ONE uses a live, consented view
            to notice meaningful moments.
          </p>
        </div>
        {stream ? (
          <div className="video-preview">
            <video ref={videoRef} autoPlay muted playsInline />
            <span className="recording-pill">
              <span className="record-dot" /> Preview only ·{" "}
              {connection
                ? "LiveKit connected"
                : demoMode
                  ? "demo"
                  : "waiting for room token"}
            </span>
          </div>
        ) : (
          <div className="camera-placeholder">
            <Camera size={32} />
            <span>Camera preview appears after consent</span>
          </div>
        )}
        <label className="publisher-consent">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <span>
            I understand what is shared and consent to camera and microphone
            capture for María’s care.
          </span>
        </label>
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
        <div className="publisher-actions">
          <button
            className="primary-button"
            onClick={stream ? togglePublisher : start}
            disabled={starting}
          >
            {stream ? (
              paused ? (
                <>
                  <Play size={16} /> Resume publishing
                </>
              ) : (
                <>
                  <Pause size={16} /> Pause publishing
                </>
              )
            ) : (
              <>
                <Video size={16} />{" "}
                {starting
                  ? "Opening secure preview…"
                  : "Start consented preview"}
              </>
            )}
          </button>
          <span className="muted secure-note">
            <LockKeyhole size={14} /> Encrypted in transit · local network
          </span>
        </div>
      </section>
      <aside className="publisher-side">
        <div className="panel step-card">
          <span className="step-number">1</span>
          <div>
            <strong>Give consent</strong>
            <span className="muted">Before any permission prompt</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">2</span>
          <div>
            <strong>Calibrate once</strong>
            <span className="muted">Point at three familiar anchors</span>
          </div>
        </div>
        <div className="panel step-card">
          <span className="step-number">3</span>
          <div>
            <strong>Stay in control</strong>
            <span className="muted">Pause whenever you need</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function JoinPage() {
  const { code: pathCode } = useParams<{ code?: string }>();
  const sanitizeCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);
  const [code, setCode] = useState(sanitizeCode(pathCode ?? ""));
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [error, setError] = useState("");
  const create = async () => {
    setError("");
    if (!demoMode && !sessionStorage.getItem("one_access_token")) {
      setError("Sign in as a caregiver before creating a publisher code.");
      return;
    }
    try {
      setCreated(await api.createPairing("Hallway phone"));
    } catch {
      setError("Only an admin or caregiver can create a publisher code.");
    }
  };
  const continuePairing = async () => {
    try {
      await api.completePairing(code);
      window.location.assign("/publisher");
    } catch {
      setError(
        "That pairing code is invalid or expired. Ask the caregiver for a new one.",
      );
    }
  };
  return (
    <div className="join-page">
      <div className="join-card panel">
        <span className="brand-mark large">O</span>
        <span className="eyebrow">PAIR A DEVICE</span>
        <h1>Bring ONE into the room.</h1>
        <p className="muted">
          Use a short code from a caregiver to securely connect this camera
          publisher. Household sign-in lives at /login.
        </p>
        <label>
          Enter a pairing code
          <input
            value={code}
            onChange={(e) => setCode(sanitizeCode(e.target.value))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </label>
        <button
          className="primary-button full-width"
          onClick={continuePairing}
          disabled={code.length !== 6}
        >
          Continue as publisher <ChevronRight size={16} />
        </button>
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
        <div className="join-divider">
          <span>or</span>
        </div>
        <button className="secondary-button full-width" onClick={create}>
          Create a publisher code
        </button>
        {created && (
          <div className="pairing-code" role="status">
            <span className="eyebrow">SHARE THIS CODE</span>
            <strong>{created.code}</strong>
            <span className="muted">
              Expires in 10 minutes · {demoMode ? "demo mode" : "local session"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.completePairing(code);
      navigate("/dashboard", { replace: true });
    } catch {
      clearSession();
      setError(
        "That code is invalid or expired. Ask the home admin for a new pairing code.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="join-page">
      <form className="join-card panel" onSubmit={submit}>
        <span className="brand-mark large">O</span>
        <span className="eyebrow">WELCOME TO ONE</span>
        <h1>Stay close to what matters.</h1>
        <p className="muted">
          Enter the six-digit code from your home admin to securely open the
          caregiver view.
        </p>
        <label htmlFor="login-code">
          Pairing code
          <input
            id="login-code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
        </label>
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
        <button
          className="primary-button full-width"
          type="submit"
          disabled={code.length !== 6 || busy}
        >
          {busy ? "Opening your home…" : "Continue securely"}{" "}
          <ChevronRight size={16} />
        </button>
        <p className="muted login-footnote">
          Your session stays in this browser until you sign out.
        </p>
      </form>
    </div>
  );
}

function AccountPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", home: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api.createAccount(form.name, form.email, form.home);
      await api.completePairing(created.pairing_code);
      navigate("/onboarding", { replace: true });
    } catch {
      setError(
        "We could not create this home. Check the details and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="join-page">
      <form className="join-card panel" onSubmit={submit}>
        <span className="brand-mark large">O</span>
        <span className="eyebrow">CREATE YOUR ONE HOME</span>
        <h1>Care, together.</h1>
        <p className="muted">
          Create a private home for the people you care about.
        </p>
        <label>
          Your name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
          />
        </label>
        <label>
          Email (optional)
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
          />
        </label>
        <label>
          Home name
          <input
            value={form.home}
            onChange={(e) => setForm({ ...form, home: e.target.value })}
            placeholder="ONE Home"
          />
        </label>
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
        <button className="primary-button full-width" disabled={busy}>
          {busy ? "Creating your home…" : "Create home"}{" "}
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => navigate("/login")}
        >
          Already have a code? Sign in
        </button>
      </form>
    </div>
  );
}

function InvitePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.acceptFamilyInvite(code, name);
      navigate("/onboarding", { replace: true });
    } catch {
      setError(
        "That invitation is invalid or expired. Ask the home admin for a new one.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="join-page">
      <form className="join-card panel" onSubmit={submit}>
        <span className="brand-mark large">O</span>
        <span className="eyebrow">JOIN A HOUSEHOLD</span>
        <h1>Care works better together.</h1>
        <p className="muted">Use the invitation code from your home admin.</p>
        <label>
          Your name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label>
          Invitation code
          <input
            required
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            placeholder="123456"
          />
        </label>
        {error && (
          <div className="error-note" role="alert">
            {error}
          </div>
        )}
        <button
          className="primary-button full-width"
          disabled={busy || code.length !== 6}
        >
          {busy ? "Joining household…" : "Join household"}{" "}
          <ChevronRight size={16} />
        </button>
      </form>
    </div>
  );
}

const onboardingKey = () => `one_onboarding_complete:${sessionStorage.getItem('one_home_id') ?? 'unknown'}:${sessionStorage.getItem('one_user_id') ?? 'unknown'}`;

function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const steps = [
    {
      purpose: "video_capture",
      title: "A clear view, with consent",
      copy: "Use camera observations to support a daily check-in.",
    },
    {
      purpose: "audio_capture",
      title: "Natural conversations",
      copy: "Use the microphone so answers can feel easy and human.",
    },
    { purpose: "family_mode", title: "Share care, intentionally", copy: "Let trusted caregivers see the context they need, with clear roles." },
    { purpose: "medication_management", title: "Keep reminders together", copy: "Organize shared reminders and acknowledgements without giving medical advice." },
  ];
  const current = steps[step];
  useEffect(() => {
    setGranted(null);
    setError("");
  }, [step]);
  const next = async () => {
    if (granted === null) return;
    setBusy(true);
    setError("");
    try {
      await api.giveConsent(current.purpose, granted);
      if (step === steps.length - 1) {
        localStorage.setItem(onboardingKey(), "true");
        onComplete();
      } else setStep(step + 1);
    } catch {
      setError("We could not save this choice. Check the local connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="join-page">
      <section className="join-card panel">
        <span className="brand-mark large">O</span>
        <span className="eyebrow">
          SET UP ONE · {step + 1} OF {steps.length}
        </span>
        <h1>{current.title}</h1>
        <p className="muted">
          {current.copy} You can change this choice any time in Privacy &
          consent.
        </p>
        <fieldset className="consent-choice">
          <legend>Allow this purpose?</legend>
          <label><input type="radio" name="onboarding-consent" checked={granted === true} onChange={() => setGranted(true)} /> Yes, enable it</label>
          <label><input type="radio" name="onboarding-consent" checked={granted === false} onChange={() => setGranted(false)} /> Not now</label>
        </fieldset>
        {error && <div className="error-note" role="alert">{error}</div>}
        <button
          className="primary-button full-width"
          onClick={next}
          disabled={busy || granted === null}
        >
          {busy
            ? "Saving your choice…"
            : step === steps.length - 1
              ? "Finish setup"
              : "Continue"}{" "}
          <ChevronRight size={16} />
        </button>
        <p className="muted onboarding-note">Complete each purpose choice to finish setup. Choosing “Not now” keeps that data source off.</p>
      </section>
    </div>
  );
}

function App() {
  const query = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const hasToken = Boolean(sessionStorage.getItem("one_access_token"));
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.getSession,
    enabled: demoMode || hasToken,
    retry: false,
  });
  const session = sessionQuery.data;
  const { data: events = demoEvents } = useQuery({
    queryKey: ["events"],
    queryFn: api.getEvents,
    enabled: demoMode || Boolean(session),
  });
  const { data: objects = demoObjects } = useQuery({
    queryKey: ["objects"],
    queryFn: api.getObjects,
    enabled: demoMode || Boolean(session),
  });
  const { data: scene = demoScene } = useQuery({
    queryKey: ["scene"],
    queryFn: api.getScene,
    enabled: demoMode || Boolean(session),
  });
  const [paused, setPaused] = useState(false);
  const [consents, setConsents] = useState(consentDefaults);
  const [selectedEvent, setSelectedEvent] = useState<HomeEvent | null>(null);
  useEffect(() => {
    if (sessionQuery.isError && !demoMode) {
      clearSession();
      void query.invalidateQueries();
    }
  }, [sessionQuery.isError, query]);
  useEffect(() => {
    if (session?.paused !== undefined) setPaused(session.paused);
  }, [session?.paused]);
  useEffect(() => {
    if (demoMode || !session) return;
    const currentHome = sessionStorage.getItem("one_home_id");
    if (!currentHome) return;
    const controller = new AbortController();
    void streamHomeEvents(
      currentHome,
      () => {
        void query.invalidateQueries({ queryKey: ["events"] });
        void query.invalidateQueries({ queryKey: ["objects"] });
        void query.invalidateQueries({ queryKey: ["scene"] });
      },
      controller.signal,
    ).catch(() => undefined);
    return () => controller.abort();
  }, [query, session]);
  const togglePause = async () => {
    if (!paused) stopActivePublisher();
    setPaused((p) => !p);
    try {
      await (paused ? api.resume() : api.pause());
    } catch {
      /* Local stop still protects privacy if the API is unavailable. */
    }
    query.invalidateQueries({ queryKey: ["events"] });
  };
  const logout = async () => {
    stopActivePublisher();
    clearPublisherRegistry();
    await api.logout();
    query.clear();
    navigate("/login", { replace: true });
  };
  if (
    !demoMode &&
    !hasToken &&
    !['/create-account', '/join-household'].includes(location.pathname) &&
    location.pathname !== "/join" &&
    !location.pathname.startsWith("/join/")
  )
    return <LoginPage />;
  if (!demoMode && hasToken && sessionQuery.isPending)
    return (
      <div className="join-page">
        <div className="join-card panel">
          <span className="brand-mark large">O</span>
          <p className="muted">Checking your secure session…</p>
        </div>
      </div>
    );
  if (!demoMode && hasToken && sessionQuery.isError) return <LoginPage />;
  const isPublisher = session?.actor.role === 'publisher';
  if (!demoMode && hasToken && session && !isPublisher && !localStorage.getItem(onboardingKey()) && location.pathname !== '/onboarding' && !location.pathname.startsWith('/join')) return <Navigate to="/onboarding" replace />;
  if (location.pathname === '/create-account') return <AccountPage />;
  if (location.pathname === '/join-household') return <InvitePage />;
  if (location.pathname === '/onboarding' && !demoMode && hasToken && isPublisher)
    return <Navigate to="/publisher" replace />;
  if (location.pathname === '/onboarding' && !demoMode && hasToken && !isPublisher)
    return <OnboardingPage onComplete={() => { localStorage.setItem(onboardingKey(), 'true'); navigate('/dashboard', { replace: true }); }} />;
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join/:code?" element={<JoinPage />} />
        <Route
          path="/publisher"
          element={
            <PublisherPage paused={paused} onTogglePause={togglePause} />
          }
        />
        <Route path="/publisher/calibrate" element={<CalibrationPage />} />
        <Route
          path="/publisher/live"
          element={
            <PublisherPage paused={paused} onTogglePause={togglePause} />
          }
        />
        <Route
          path="*"
          element={
            <Shell
              paused={paused}
              onTogglePause={togglePause}
              onLogout={logout}
            >
              <Routes>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="dashboard"
                  element={
                    <Dashboard
                      events={events}
                      objects={objects}
                      onEvent={setSelectedEvent}
                    />
                  }
                />
                <Route path="dashboard/live" element={<LivePage />} />
                <Route
                  path="dashboard/map"
                  element={<MapPage objects={objects} scene={scene} />}
                />
                <Route
                  path="dashboard/events"
                  element={
                    <EventsPage events={events} onEvent={setSelectedEvent} />
                  }
                />
                <Route path="dashboard/assistant" element={<AssistantPage />} />{" "}
                <Route path="dashboard/family" element={<FamilyPage />} />
                <Route
                  path="dashboard/privacy"
                  element={
                    <PrivacyPage
                      paused={paused}
                      onTogglePause={togglePause}
                      consents={consents}
                      setConsents={setConsents}
                    />
                  }
                />
              </Routes>
            </Shell>
          }
        />
      </Routes>
      {selectedEvent && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelectedEvent(null)}
        >
          <section
            className="event-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setSelectedEvent(null)}
              aria-label="Close event"
            >
              <X size={18} />
            </button>
            <span className="eyebrow">
              OBSERVED MOMENT · {formatTime(selectedEvent.occurredAt)}
            </span>
            <h2 id="event-modal-title">{selectedEvent.title}</h2>
            <p>{selectedEvent.detail}</p>
            <div className="evidence-note">
              <ShieldCheck size={16} /> Source linked · ONE reports
              observations, not a diagnosis.
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default App;

function FamilyPage() {
  const nav = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState(() => sessionStorage.getItem('one_subject_user_id') ?? '');
  const hasBackendSession =
    !demoMode &&
    Boolean(
      sessionStorage.getItem("one_access_token") &&
      sessionStorage.getItem("one_home_id"),
    );
  const familyQuery = useQuery({
    queryKey: ["family-members"],
    queryFn: api.getFamilyMembers,
    enabled: hasBackendSession,
    retry: false,
  });
  const reminderQuery = useQuery({
    queryKey: ["medication-reminders", new Date().toISOString().slice(0, 10), selectedSubject],
    queryFn: () => api.getMedicationReminders(new Date().toISOString().slice(0, 10), selectedSubject || undefined),
    enabled: hasBackendSession,
    retry: false,
  });
  useEffect(() => {
    const handleSubjectChange = (event: Event) => setSelectedSubject((event as CustomEvent<string>).detail);
    window.addEventListener('one:subject-change', handleSubjectChange);
    return () => window.removeEventListener('one:subject-change', handleSubjectChange);
  }, []);
  const demoCaregivers = [
    {
      name: "Clara García",
      initials: "CG",
      role: "Admin + caregiver",
      state: "Full controls · owns check-ins",
      tone: "admin",
    },
    {
      name: "Jordi García",
      initials: "JG",
      role: "Caregiver",
      state: "Events + reminders · assigned doses",
      tone: "caregiver",
    },
    {
      name: "Nuria García",
      initials: "NG",
      role: "Caregiver",
      state: "Check-ins · no privacy controls",
      tone: "caregiver",
    },
    {
      name: "Pau García",
      initials: "PG",
      role: "Viewer",
      state: "Read-only moments",
      tone: "viewer",
    },
  ];
  const demoDoses = [
    {
      time: "08:30",
      label: "Morning routine",
      detail: "After breakfast",
      owner: "Clara García",
      acknowledgement: "Acknowledged by Clara",
      state: "Acknowledged",
      tone: "done",
    },
    {
      time: "13:00",
      label: "Midday routine",
      detail: "With lunch",
      owner: "Jordi García",
      acknowledgement: "No acknowledgement yet",
      state: "Next dose",
      tone: "next",
    },
    {
      time: "20:30",
      label: "Evening routine",
      detail: "Before bed",
      owner: "Nuria García",
      acknowledgement: "Jordi to confirm",
      state: "Needs confirmation",
      tone: "pending",
    },
  ];
  const roleDetails = (role: FamilyMember["role"]) =>
    role === "admin"
      ? ["Admin + caregiver", "Full home controls · owns check-ins", "admin"]
      : role === "caregiver"
        ? ["Caregiver", "Events + reminders · assigned doses", "caregiver"]
        : ["Resident", "Personal view · consent-led", "viewer"];
  const liveCaregivers = (familyQuery.data ?? []).map((member) => {
    const [role, state, tone] = roleDetails(member.role);
    return {
      name: member.display_name,
      initials: member.display_name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      role,
      state,
      tone,
    };
  });
  const liveDoses = (reminderQuery.data ?? []).map((reminder) => {
    const owner = reminder.assigned_caregiver_name ?? "Unassigned";
    const state =
      reminder.status === "taken"
        ? "Acknowledged"
        : reminder.status === "missed"
          ? "Missed"
          : reminder.status === "skipped"
            ? "Skipped"
            : "Needs confirmation";
    const tone =
      reminder.status === "taken"
        ? "done"
        : reminder.status === "pending"
          ? "pending"
          : "next";
    const acknowledgement =
      reminder.status === "taken"
        ? `Acknowledged${reminder.note ? ` · ${reminder.note}` : ""}`
        : reminder.status === "pending"
          ? "No acknowledgement yet"
          : reminder.status;
    return {
      time: new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(reminder.scheduled_for)),
      label: reminder.name,
      detail: `${reminder.dose}${reminder.instructions ? ` · ${reminder.instructions}` : ""}`,
      owner,
      acknowledgement,
      state,
      tone,
      scheduleRule: reminder.schedule_rule,
    };
  });
  const caregivers = hasBackendSession ? liveCaregivers : demoCaregivers;
  const doses = hasBackendSession ? liveDoses : demoDoses;
  const liveError =
    hasBackendSession && (familyQuery.isError || reminderQuery.isError);
  const nextDose =
    doses.find((dose) => dose.tone === "next" || dose.tone === "pending") ??
    doses[0];
  return (
    <div className="family-page">
      <section className="family-intro">
        <span className="eyebrow">FAMILY MODE · THE GARCÍA HOME</span>
        <h2>Care works better together.</h2>
        <p>
          Household members can also be caregivers. Keep everyone aligned with
          clear roles, shared reminders, and calm context.
        </p>
        {hasBackendSession && <label className="muted" htmlFor="family-recipient">Viewing reminders for <select id="family-recipient" value={selectedSubject} onChange={(e) => { const value = e.target.value; setSelectedSubject(value); sessionStorage.setItem('one_subject_user_id', value); window.dispatchEvent(new CustomEvent('one:subject-change', { detail: value })); }}><option value="">My care view</option>{(familyQuery.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>}
      </section>
      {liveError && (
        <div className="family-data-note" role="status">
          <ShieldCheck size={15} /> Family consent or medication access is not
          active yet. No live household records are shown.
        </div>
      )}
      <div className="family-grid">
        <section className="panel family-people">
          <div className="section-heading">
            <div>
              <span className="eyebrow">HOUSEHOLD CIRCLE</span>
              <h3>People with a view</h3>
            </div>
            <button className="secondary-button">
              <Users size={16} /> Invite caregiver
            </button>
          </div>
          <div className="caregiver-list">
            {caregivers.length ? (
              caregivers.map((person) => (
                <div
                  className="caregiver-row"
                  key={`${person.name}-${person.role}`}
                  aria-label={`${person.name}, ${person.role}. ${person.state}`}
                >
                  <span className="caregiver-avatar" aria-hidden="true">
                    {person.initials}
                  </span>
                  <span className="caregiver-copy">
                    <strong>{person.name}</strong>
                    <span>{person.state}</span>
                  </span>
                  <span
                    className={`role-badge ${person.tone}`}
                    aria-label={`Permission level: ${person.role}`}
                  >
                    {person.role}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-family">
                No household members are visible yet. An admin can invite a
                caregiver after recording family consent.
              </p>
            )}
          </div>
          <p className="family-note">
            <ShieldCheck size={15} /> Roles keep each person’s access
            purposeful. Only the admin can change privacy and home controls.
          </p>
        </section>
        <section className="panel medication-plan">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MEDICATION PLAN · TODAY</span>
              <h3>A simple shared rhythm.</h3>
            </div>
            <button className="text-button">
              Add or edit <ChevronRight size={15} />
            </button>
          </div>
          {nextDose ? (
            <div className="next-dose">
              <span className="eyebrow">
                NEXT DOSE · ASSIGNED TO {nextDose.owner.toUpperCase()}
              </span>
              <strong>{nextDose.time}</strong>
              <span>
                {nextDose.label} · {nextDose.detail}
              </span>
            </div>
          ) : (
            <div className="empty-family">
              No doses are scheduled for this day. Check the plan’s weekly rules
              before adding one.
            </div>
          )}
          <div className="dose-list">
            {doses.map((dose) => (
              <div
                className="dose-row"
                key={`${dose.time}-${dose.label}`}
                aria-label={`${dose.label}, ${dose.time}`}
              >
                <time>{dose.time}</time>
                <span>
                  <strong>{dose.label}</strong>
                  <small>{dose.detail}</small>
                  <small className="dose-owner">
                    Assigned to {dose.owner} · {dose.acknowledgement}
                    {"scheduleRule" in dose && dose.scheduleRule
                      ? ` · Rule: ${dose.scheduleRule}`
                      : ""}
                  </small>
                </span>
                <span
                  className={`dose-state ${dose.tone}`}
                  role="status"
                  aria-label={`${dose.state}. Assigned to ${dose.owner}. ${dose.acknowledgement}`}
                >
                  {dose.state}
                </span>
              </div>
            ))}
          </div>
          <p className="muted plan-disclaimer">
            ONE helps organize reminders and acknowledgements. It does not
            provide medical advice.
          </p>
        </section>
        <section className="family-assistant panel">
          <span className="assistant-spark">
            <Sparkles size={19} />
          </span>
          <div>
            <span className="eyebrow">ASK ABOUT THE PLAN</span>
            <h3>“What needs a check today?”</h3>
            <p className="muted">
              The family assistant summarizes scheduled reminders and who
              acknowledged them. It does not give medical advice.
            </p>
            <button
              className="primary-button"
              onClick={() => nav("/dashboard/assistant")}
            >
              Open organizer assistant <MessageCircle size={16} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
