import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ChevronRight, House, Map, MapPin, MessageCircle, MonitorDown, ShieldCheck, Smartphone, Users, X } from "lucide-react";
import { SiteFooter, SiteHeader } from "./marketing";
import "./appDownload.css";
import "./appDownloadPreview.css";
import "./appDownloadDashboard.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const features = [
  { icon: House, title: "Home map", text: "Review rooms and approximate context for connected devices." },
  { icon: Camera, title: "Camera views", text: "Open available views and events according to household permissions." },
  { icon: MessageCircle, title: "Check-ins", text: "Review submitted answers and response times." },
  { icon: Users, title: "Family access", text: "See the home information shared with your account." },
];

const previewTabs = [
  { id: "home", label: "Home", icon: House },
  { id: "map", label: "Map", icon: Map },
  { id: "family", label: "Family", icon: Users },
  { id: "assistant", label: "Assistant", icon: MessageCircle },
  { id: "account", label: "Account", icon: ShieldCheck },
] as const;

type PreviewTab = (typeof previewTabs)[number]["id"];
type PreviewScreen = PreviewTab | "cameras";

function AppPreview() {
  const [screen, setScreen] = useState<PreviewScreen>("home");
  const [selectedRoom, setSelectedRoom] = useState("Living room");
  const [selectedSpace, setSelectedSpace] = useState("My home");
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerSaved, setAnswerSaved] = useState(false);
  const activeTab: PreviewTab = screen === "cameras" ? "home" : screen;

  return <div className="one-app-device">
    <div className="one-app-phone" aria-label="Interactive ONE app sample">
      <div className="one-app-phone-island" aria-hidden="true" />
      <div className="one-app-phone-status"><span>9:41</span><span>●●● &nbsp; ◖ ▰</span></div>
      <div className="one-app-phone-brand"><img src="/one-logo.png" alt="" /><strong>one</strong><span>DEMO</span></div>
      <div className="one-app-phone-screen" role="tabpanel" id="one-app-preview-panel" aria-labelledby={`one-app-tab-${activeTab}`}>
        {screen === "home" && <div className="one-app-preview-view one-app-preview-home">
          <span className="one-app-sample-label">SAMPLE DAY</span>
          <h2>Welcome back</h2>
          <p className="one-app-preview-date">Here is the home overview for today.</p>
          <button type="button" className="one-app-preview-care-space" onClick={() => setSpaceMenuOpen(value => !value)} aria-expanded={spaceMenuOpen}>
            <span className="one-app-preview-care-space-icon"><House size={19} /></span>
            <span><small>CURRENT CARE SPACE</small><strong>{selectedSpace}</strong><small>2 people · Home</small></span>
            <ChevronRight size={17} />
          </button>
          {spaceMenuOpen && <div className="one-app-preview-space-menu" aria-label="Sample care spaces">{["My home", "Shared home"].map(space => <button type="button" key={space} onClick={() => { setSelectedSpace(space); setSpaceMenuOpen(false); }} aria-pressed={selectedSpace === space}>{space}</button>)}</div>}
          <section className="one-app-preview-overview">
            <h3>Care overview</h3>
            <strong>Nothing scheduled right now</strong>
            <small>3 sample events</small>
            <button type="button" className="one-app-preview-start" onClick={() => setScreen("assistant")}><Check size={15} /> Start today’s check-in</button>
            <button type="button" className="one-app-preview-plan" onClick={() => setScreen("map")}>Open today’s plan <ArrowRight size={15} /></button>
          </section>
          <section className="one-app-preview-glance">
            <h3>At a glance</h3>
            <div>
              <button type="button" onClick={() => setScreen("map")}><Map size={17} /><strong>Map</strong><small>Set up your home</small><ChevronRight size={14} /></button>
              <button type="button" onClick={() => setScreen("cameras")}><Camera size={17} /><strong>Cameras</strong><small>Sample device</small><ChevronRight size={14} /></button>
            </div>
          </section>
          <section className="one-app-preview-events">
            <div><h3>Events</h3><span>Sample</span></div>
            <button type="button" onClick={() => setScreen("assistant")}><MessageCircle size={15} /><span><strong>Daily check-in</strong><small>Example · Today</small></span><ChevronRight size={14} /></button>
            <button type="button" onClick={() => setScreen("cameras")}><Camera size={15} /><span><strong>Camera view</strong><small>Example · Living room</small></span><ChevronRight size={14} /></button>
          </section>
        </div>}
        {screen === "map" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">SAMPLE FLOOR PLAN</span>
          <h2>Home map</h2>
          <p className="one-app-preview-date">Choose a room to see its example location.</p>
          <div className="one-app-preview-floorplan" aria-label="Illustrative four-room floor plan">
            {["Bedroom", "Bath", "Living room", "Kitchen"].map(room => <button key={room} type="button" className={selectedRoom === room ? "selected" : ""} aria-pressed={selectedRoom === room} onClick={() => setSelectedRoom(room)}>{room}{selectedRoom === room && <MapPin size={14} />}</button>)}
          </div>
          <div className="one-app-preview-room-detail"><MapPin size={16} /><span><strong>{selectedRoom}</strong><small>Illustrative room · no live location</small></span></div>
        </div>}
        {screen === "cameras" && <div className="one-app-preview-view">
          <button type="button" className="one-app-preview-back" onClick={() => setScreen("home")}><ArrowLeft size={15} /> Home</button>
          <span className="one-app-sample-label">DEVICE CONCEPT</span>
          <h2>Cameras</h2>
          <p className="one-app-preview-date">Sample device card · not a live camera feed</p>
          <div className="one-app-preview-camera"><img src="/product-assets/camera-anatomy/standing-camera.webp" alt="Illustrative standing camera concept" /><span><i /> SAMPLE DEVICE</span></div>
          <section className="one-app-preview-device-row"><Camera size={17} /><span><strong>Living room camera</strong><small>Example device · access depends on consent</small></span><ChevronRight size={16} /></section>
          <p className="one-app-preview-privacy"><ShieldCheck size={14} /> Camera and microphone access are controlled separately.</p>
        </div>}
        {screen === "assistant" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">INTERACTIVE SAMPLE</span>
          <h2>Today’s check-in</h2>
          <p className="one-app-preview-date">How are you feeling today?</p>
          <div className="one-app-preview-answers">{["Good", "Okay", "I need help"].map(option => <button type="button" key={option} className={answer === option ? "selected" : ""} aria-pressed={answer === option} onClick={() => { setAnswer(option); setAnswerSaved(false); }}>{option}</button>)}</div>
          <button type="button" className="one-app-preview-save" disabled={!answer} onClick={() => setAnswerSaved(true)}>{answerSaved ? <><Check size={16} /> Sample answer saved</> : <>Save sample answer <ChevronRight size={16} /></>}</button>
          <p className="one-app-preview-privacy"><ShieldCheck size={14} /> This demo stays on this page and is not sent to ONE.</p>
        </div>}
        {screen === "family" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">SAMPLE HOUSEHOLD</span>
          <h2>Family & care team</h2>
          <p className="one-app-preview-date">Example access roles</p>
          <div className="one-app-preview-member"><b>01</b><span><strong>Household admin</strong><small>Example role</small></span><ShieldCheck size={15} /></div>
          <div className="one-app-preview-member"><b>02</b><span><strong>Caregiver</strong><small>Example role</small></span><Users size={15} /></div>
          <section className="one-app-preview-shared"><strong>Shared with this account</strong><p>Home overview, check-ins, and permitted device views.</p><small>Example only · access depends on household permissions</small></section>
        </div>}
        {screen === "account" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">SAMPLE ACCOUNT</span>
          <h2>Account & privacy</h2>
          <p className="one-app-preview-date">Example settings for this care space.</p>
          <section className="one-app-preview-shared"><strong>Camera permissions</strong><p>Camera access follows the household settings and consent choices.</p></section>
          <section className="one-app-preview-shared"><strong>Shared information</strong><p>People see information according to their household access.</p></section>
          <a className="one-app-preview-legal" href="/legal/privacy-notice.html#privacy">Privacy notice <ArrowRight size={14} /></a>
          <a className="one-app-preview-legal" href="/legal/privacy-notice.html#terms">Terms of use <ArrowRight size={14} /></a>
        </div>}
      </div>
      <nav className="one-app-preview-tabs" role="tablist" aria-label="Sample app screens">
        {previewTabs.map(item => { const Icon = item.icon; return <button id={`one-app-tab-${item.id}`} role="tab" aria-selected={activeTab === item.id} aria-controls="one-app-preview-panel" key={item.id} type="button" onClick={() => setScreen(item.id)}><Icon size={17} /><span>{item.label}</span></button>; })}
      </nav>
      <span className="one-app-phone-home-indicator" aria-hidden="true" />
    </div>
  </div>;
}

export function AppDownloadPage() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [instructions, setInstructions] = useState<"Android" | "Windows" | null>(null);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  const install = async (platform: "Android" | "Windows") => {
    if (installEvent) {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } else {
      setInstructions(platform);
    }
  };

  return <main className="one-app-page">
    <SiteHeader section="app" />
    <section className="one-app-hero"><div><h1>ONE on your devices</h1><p>Install ONE as a web app on Android or Windows. Available information depends on your account, home setup, and permissions.</p><div className="one-app-cta"><button onClick={() => void install("Android")}><Smartphone /> Install on Android <ArrowRight size={18} /></button><button onClick={() => void install("Windows")}><MonitorDown /> Install on Windows <ArrowRight size={18} /></button></div><small>A supported browser and an internet connection are required for live information.</small></div><AppPreview /></section>
    <section className="one-app-features"><h2>In the ONE app</h2><div>{features.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={27} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    {instructions && <div className="one-app-instructions" onClick={() => setInstructions(null)}><section role="dialog" aria-modal="true" aria-label={`Install on ${instructions}`} onClick={event => event.stopPropagation()}><button onClick={() => setInstructions(null)} aria-label="Close"><X /></button><h2>Install ONE on {instructions}</h2><p>{instructions === "Android" ? "Open this page in Chrome for Android. From the browser menu, choose ‘Install app’ or ‘Add to Home screen’." : "Open this page in Microsoft Edge or Chrome for Windows. Use the install icon in the address bar or choose ‘Apps’ → ‘Install this site as an app’ from the menu."}</p><p>Installation on localhost depends on the browser. Serve the site over HTTPS to install it on other devices.</p></section></div>}
    <SiteFooter />
  </main>;
}
