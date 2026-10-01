import { useEffect, useState } from "react";
import { Activity, ArrowRight, Camera, Check, ChevronRight, Heart, House, Map, MapPin, MessageCircle, MonitorDown, ShieldCheck, Smartphone, Users, X } from "lucide-react";
import { SiteFooter, SiteHeader } from "./marketing";
import "./appDownload.css";
import "./appDownloadPreview.css";

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
  { id: "camera", label: "Camera", icon: Camera },
  { id: "check-in", label: "Check-in", icon: MessageCircle },
  { id: "family", label: "Family", icon: Users },
] as const;

type PreviewTab = (typeof previewTabs)[number]["id"];

function AppPreview() {
  const [tab, setTab] = useState<PreviewTab>("home");
  const [selectedRoom, setSelectedRoom] = useState("Living room");
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerSaved, setAnswerSaved] = useState(false);

  return <div className="one-app-device">
    <div className="one-app-phone" aria-label="Interactive ONE app sample">
      <div className="one-app-phone-island" aria-hidden="true" />
      <div className="one-app-phone-status"><span>9:41</span><span>●●● &nbsp; ◖ ▰</span></div>
      <div className="one-app-phone-brand"><img src="/one-logo.png" alt="" /><strong>one</strong><span>DEMO</span></div>
      <div className="one-app-phone-screen" role="tabpanel" id="one-app-preview-panel" aria-labelledby={`one-app-tab-${tab}`}>
        {tab === "home" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">SAMPLE DATA</span>
          <h2>Good morning, Alex</h2>
          <p className="one-app-preview-date">A simple view of today at home</p>
          <button className="one-app-preview-map-card" onClick={() => setTab("map")}>
            <span className="one-app-preview-card-head"><strong>Home map</strong><ChevronRight size={16} /></span>
            <span className="one-app-preview-room-grid"><i>Living room</i><i>Kitchen</i><i>Bedroom</i><i>Hall</i></span>
            <span className="one-app-preview-map-caption"><MapPin size={13} /> {selectedRoom} · sample location</span>
          </button>
          <section className="one-app-preview-reminder"><span><Heart size={16} /> NEXT REMINDER</span><strong>Sample medication</strong><small>8:00 AM · example only</small></section>
          <section className="one-app-preview-activity"><span><Activity size={16} /> RECENT ACTIVITY</span><p>Movement observed <small>Living room · 10:13 AM</small></p></section>
        </div>}
        {tab === "map" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">SAMPLE FLOOR PLAN</span>
          <h2>Home map</h2>
          <p className="one-app-preview-date">Choose a room to see its example location.</p>
          <div className="one-app-preview-floorplan" aria-label="Illustrative four-room floor plan">
            {["Bedroom", "Bath", "Living room", "Kitchen"].map(room => <button key={room} type="button" className={selectedRoom === room ? "selected" : ""} aria-pressed={selectedRoom === room} onClick={() => setSelectedRoom(room)}>{room}{selectedRoom === room && <MapPin size={14} />}</button>)}
          </div>
          <div className="one-app-preview-room-detail"><MapPin size={16} /><span><strong>{selectedRoom}</strong><small>Illustrative room · no live location</small></span></div>
        </div>}
        {tab === "camera" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">DEVICE CONCEPT</span>
          <h2>Cameras</h2>
          <p className="one-app-preview-date">Sample device card · not a live camera feed</p>
          <div className="one-app-preview-camera"><img src="/product-assets/camera-anatomy/standing-camera.webp" alt="Illustrative standing camera concept" /><span><i /> SAMPLE DEVICE</span></div>
          <section className="one-app-preview-device-row"><Camera size={17} /><span><strong>Living room camera</strong><small>Example device · access depends on consent</small></span><ChevronRight size={16} /></section>
          <p className="one-app-preview-privacy"><ShieldCheck size={14} /> Camera and microphone access are controlled separately.</p>
        </div>}
        {tab === "check-in" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">INTERACTIVE SAMPLE</span>
          <h2>Today’s check-in</h2>
          <p className="one-app-preview-date">How are you feeling today?</p>
          <div className="one-app-preview-answers">{["Good", "Okay", "Not great"].map(option => <button type="button" key={option} className={answer === option ? "selected" : ""} aria-pressed={answer === option} onClick={() => { setAnswer(option); setAnswerSaved(false); }}>{option}</button>)}</div>
          <button type="button" className="one-app-preview-save" disabled={!answer} onClick={() => setAnswerSaved(true)}>{answerSaved ? <><Check size={16} /> Sample answer saved</> : <>Save sample answer <ChevronRight size={16} /></>}</button>
          <p className="one-app-preview-privacy"><ShieldCheck size={14} /> This demo stays on this page and is not sent to ONE.</p>
        </div>}
        {tab === "family" && <div className="one-app-preview-view">
          <span className="one-app-sample-label">SAMPLE HOUSEHOLD</span>
          <h2>Family & care team</h2>
          <p className="one-app-preview-date">Example names and access roles</p>
          <div className="one-app-preview-member"><b>AM</b><span><strong>Alex Morgan</strong><small>Home admin · sample</small></span><ShieldCheck size={15} /></div>
          <div className="one-app-preview-member"><b>JM</b><span><strong>Jamie Morgan</strong><small>Caregiver · sample</small></span><Users size={15} /></div>
          <section className="one-app-preview-shared"><strong>Shared with this account</strong><p>Home overview, check-ins, and permitted device views.</p><small>Example only · access depends on household permissions</small></section>
        </div>}
      </div>
      <nav className="one-app-preview-tabs" role="tablist" aria-label="Sample app screens">
        {previewTabs.map(item => { const Icon = item.icon; return <button id={`one-app-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls="one-app-preview-panel" key={item.id} type="button" onClick={() => setTab(item.id)}><Icon size={17} /><span>{item.label}</span></button>; })}
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
