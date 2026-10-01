import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, clearSession, demoMode } from "../api/client";
import { consentDefaults, demoEvents, demoObjects, demoScene } from "../demo/data";
import type { HomeEvent, Scene } from "../models/domain";
import { streamHomeEvents } from "../api/sse";
import { clearPublisherRegistry, stopActivePublisher } from "../livekit/registry";
import { Shell, formatTime } from "./shared";
import { OverviewPage } from "./overview";
import { MapPage } from "./map";
import { EventsPage } from "./events";
import { AssistantPage } from "./assistant";
import { CameraManagerPage } from "./publisher";
import { CheckInPage } from "./checkIn";
import { QuestionsPage } from "./questions";
import { CareSummaryPage } from "./careSummary";
import { MarketingSite } from "./marketing";
import { AppDownloadPage } from "./appDownload";
import { OnboardingPage, onboardingKey } from "./auth";
import { LoginPage } from "./login";
import { RegisterPage } from "./register";
import { PrivacyPage } from "./privacy";
import { AccountSettingsPage } from "./account";
import { FamilyPage } from "./family";
import { CameraReconnectPage, JoinPage, PublisherPage } from "./pages/CameraPairingPage";
import { HouseholdInvitePage } from "./pages/HouseholdInvitePage";

const emptyLiveScene: Scene = {
  sceneId: "scene-empty",
  version: 0,
  zones: [],
  dimension: "2d",
  source: "legacy-2d",
  metricScaleKnown: false,
  geometryStatus: "unavailable",
};

function App() {
  const query = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const hasToken = Boolean(sessionStorage.getItem("one_access_token"));
  const hasDemoAccess = demoMode && sessionStorage.getItem("one_dashboard_access") === "garcia-family";
  const isCameraReconnect = location.pathname.startsWith("/camera/");
  const sessionQuery = useQuery({ queryKey: ["session"], queryFn: api.getSession, enabled: (demoMode || hasToken) && !isCameraReconnect, retry: false });
  const session = sessionQuery.data;
  const [recipientId, setRecipientId] = useState(() => sessionStorage.getItem("one_care_recipient_id") || "");
  useEffect(() => {
    const update = (event: Event) => setRecipientId((event as CustomEvent<string>).detail || "");
    window.addEventListener("one:care-recipient-change", update);
    return () => window.removeEventListener("one:care-recipient-change", update);
  }, []);
  const { data: fetchedEvents } = useQuery({ queryKey: ["events", session?.home.id, recipientId], queryFn: () => api.getEvents(recipientId || null), enabled: demoMode || Boolean(session) });
  const { data: fetchedObjects } = useQuery({ queryKey: ["objects", session?.home.id, recipientId], queryFn: () => api.getObjects(recipientId || null), enabled: demoMode || Boolean(session) });
  const { data: fetchedScene } = useQuery({ queryKey: ["scene"], queryFn: api.getScene, enabled: demoMode || Boolean(session) });
  const events = fetchedEvents ?? (demoMode ? demoEvents.filter((event) => !recipientId || !event.careRecipientId || event.careRecipientId === recipientId) : []);
  const objects = fetchedObjects ?? (demoMode ? demoObjects.filter((item) => !recipientId || !item.careRecipientId || item.careRecipientId === recipientId) : []);
  const scene = fetchedScene ?? (demoMode ? demoScene : emptyLiveScene);
  const [paused, setPaused] = useState(false);
  const [consents, setConsents] = useState(consentDefaults);
  const [selectedEvent, setSelectedEvent] = useState<HomeEvent | null>(null);

  useEffect(() => {
    if (sessionQuery.isError && !demoMode) { clearSession(); void query.invalidateQueries(); }
  }, [sessionQuery.isError, query]);
  useEffect(() => {
    if (demoMode) return;
    const onSessionExpired = () => {
      stopActivePublisher();
      clearPublisherRegistry();
      clearSession();
      query.clear();
      navigate('/login', { replace: true });
    };
    window.addEventListener('one:session-expired', onSessionExpired);
    return () => window.removeEventListener('one:session-expired', onSessionExpired);
  }, [navigate, query]);
  useEffect(() => { if (session?.paused !== undefined) setPaused(session.paused); }, [session?.paused]);
  useEffect(() => {
    if (demoMode || !session) return;
    const currentHome = sessionStorage.getItem("one_home_id");
    if (!currentHome) return;
    const controller = new AbortController();
    void streamHomeEvents(currentHome, () => { void query.invalidateQueries({ queryKey: ["events"] }); void query.invalidateQueries({ queryKey: ["objects"] }); void query.invalidateQueries({ queryKey: ["scene"] }); void query.invalidateQueries({ queryKey: ["caregiver-summaries"] }); void query.invalidateQueries({ queryKey: ["check-in-questions"] }); }, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [query, session]);
  const togglePause = async () => {
    if (!paused) stopActivePublisher();
    setPaused((value) => !value);
    try { await (paused ? api.resume() : api.pause()); } catch { /* Local stop still protects privacy if the API is unavailable. */ }
    void query.invalidateQueries({ queryKey: ["events"] });
  };
  const logout = async () => { stopActivePublisher(); clearPublisherRegistry(); await api.logout(); sessionStorage.removeItem("one_dashboard_access"); sessionStorage.removeItem("one_care_recipient_id"); query.clear(); navigate("/login", { replace: true }); };

  if (location.pathname === "/designs") return <Navigate to="/products" replace />;
  if (location.pathname === "/app") return <AppDownloadPage />;
  if (["/", "/how-it-works", "/products", "/products/hub", "/products/camera", "/products/family", "/products/exterior", "/technology", "/support"].includes(location.pathname)) return <MarketingSite />;
  if (demoMode && !hasDemoAccess && location.pathname !== "/login" && !location.pathname.startsWith("/join") && !location.pathname.startsWith("/camera/")) return <LoginPage />;
  if (demoMode && hasDemoAccess && location.pathname === "/login") return <Navigate to="/dashboard" replace />;
  if (!demoMode && !hasToken && !["/create-account", "/join-household"].includes(location.pathname) && location.pathname !== "/join" && !location.pathname.startsWith("/join/") && !location.pathname.startsWith("/camera/")) return <LoginPage />;
  if (!demoMode && hasToken && sessionQuery.isPending && !isCameraReconnect) return <div className="join-page"><div className="join-card panel"><img className="one-logo large" src="/one-logo.png" alt="" aria-hidden="true" /><p className="muted">Checking your secure session…</p></div></div>;
  if (!demoMode && hasToken && sessionQuery.isError && !isCameraReconnect) return <LoginPage />;
  const isPublisher = session?.actor.role === "publisher";
  if (!demoMode && hasToken && session && !isPublisher && !localStorage.getItem(onboardingKey()) && location.pathname !== "/onboarding" && !location.pathname.startsWith("/join")) return <Navigate to="/onboarding" replace />;
  if (location.pathname === "/create-account") return <RegisterPage />;
  if (location.pathname === "/join-household") return <HouseholdInvitePage />;
  if (location.pathname === "/onboarding" && !demoMode && hasToken && isPublisher) return <Navigate to="/publisher" replace />;
  if (location.pathname === "/onboarding" && !demoMode && hasToken && !isPublisher) return <OnboardingPage onComplete={() => { localStorage.setItem(onboardingKey(), "true"); navigate("/dashboard", { replace: true }); }} />;

  return <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join/:code?" element={<JoinPage />} />
      <Route path="/camera/:cameraId" element={<CameraReconnectPage paused={paused} onTogglePause={togglePause} />} />
      <Route path="/publisher" element={<PublisherPage paused={paused} onTogglePause={togglePause} />} />
      <Route path="/publisher/live" element={<PublisherPage paused={paused} onTogglePause={togglePause} />} />
      <Route path="*" element={<Shell paused={paused} onTogglePause={togglePause} onLogout={logout} session={session}><Routes>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<OverviewPage events={events} objects={objects} onEvent={setSelectedEvent} session={session} recipientId={recipientId} />} />
        <Route path="dashboard/live" element={<CheckInPage events={events} session={session} onEvent={setSelectedEvent} recipientId={recipientId} />} />
        <Route path="dashboard/questions" element={<QuestionsPage recipientId={recipientId} />} />
        <Route path="dashboard/questions/summary" element={<CareSummaryPage recipientId={recipientId} />} />
        <Route path="dashboard/map" element={<MapPage objects={objects} scene={scene} recipientId={recipientId} />} />
        <Route path="dashboard/cameras" element={<CameraManagerPage paused={paused} />} />
        <Route path="dashboard/events" element={<EventsPage events={events} onEvent={setSelectedEvent} recipientId={recipientId} />} />
        <Route path="dashboard/assistant" element={<AssistantPage session={session} />} />
        <Route path="dashboard/family" element={<FamilyPage session={session} />} />
        <Route path="dashboard/account" element={<AccountSettingsPage onLogout={logout} />} />
        <Route path="dashboard/privacy" element={<PrivacyPage paused={paused} onTogglePause={togglePause} consents={consents} setConsents={setConsents} />} />
      </Routes></Shell>} />
    </Routes>
    {selectedEvent && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}><section className="event-modal panel" role="dialog" aria-modal="true" aria-labelledby="event-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close icon-button" onClick={() => setSelectedEvent(null)} aria-label="Close event"><X size={18} /></button><span className="eyebrow">OBSERVED MOMENT · {formatTime(selectedEvent.occurredAt)}</span><h2 id="event-modal-title">{selectedEvent.title}</h2><p>{selectedEvent.detail}</p>{selectedEvent.cameraName && <p>Camera: {selectedEvent.cameraName}{selectedEvent.roomName ? ` · ${selectedEvent.roomName}` : ""}</p>}{selectedEvent.cameraId && <button className="primary-button" onClick={() => { navigate(`/dashboard/cameras?camera=${encodeURIComponent(selectedEvent.cameraId!)}`); setSelectedEvent(null); }}>View source camera</button>}<div className="evidence-note"><ShieldCheck size={16} /> {selectedEvent.cameraId ? "Camera source linked" : "Household observation"} · not a diagnosis.</div></section></div>}
  </>;
}

export default App;
