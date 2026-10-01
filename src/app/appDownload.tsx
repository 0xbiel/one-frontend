import { useEffect, useState } from "react";
import { ArrowRight, Camera, House, MessageCircle, MonitorDown, Smartphone, Users, X } from "lucide-react";
import { SiteFooter, SiteHeader } from "./marketing";
import "./appDownload.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const features = [
  { icon: House, title: "Home map", text: "Review rooms and approximate context for connected devices." },
  { icon: Camera, title: "Camera views", text: "Open available views and events according to household permissions." },
  { icon: MessageCircle, title: "Check-ins", text: "Review submitted answers and response times." },
  { icon: Users, title: "Family access", text: "See the home information shared with your account." },
];

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
    <section className="one-app-hero"><div><h1>ONE on your devices</h1><p>Install ONE as a web app on Android or Windows. Available information depends on your account, home setup, and permissions.</p><div className="one-app-cta"><button onClick={() => void install("Android")}><Smartphone /> Install on Android <ArrowRight size={18} /></button><button onClick={() => void install("Windows")}><MonitorDown /> Install on Windows <ArrowRight size={18} /></button></div><small>A supported browser and an internet connection are required for live information.</small></div><div className="one-app-device"><div className="one-app-phone"><div className="one-app-phone-top">one <span>Example</span></div><h2>Home overview</h2><div className="one-app-phone-wave">Illustrative preview</div><div className="one-app-phone-tile">⌂ &nbsp; Home map</div><div className="one-app-phone-tile">◉ &nbsp; Camera views</div><div className="one-app-phone-tile">✓ &nbsp; Check-ins</div></div></div></section>
    <section className="one-app-features"><h2>In the ONE app</h2><div>{features.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={27} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    {instructions && <div className="one-app-instructions" onClick={() => setInstructions(null)}><section role="dialog" aria-modal="true" aria-label={`Install on ${instructions}`} onClick={event => event.stopPropagation()}><button onClick={() => setInstructions(null)} aria-label="Close"><X /></button><h2>Install ONE on {instructions}</h2><p>{instructions === "Android" ? "Open this page in Chrome for Android. From the browser menu, choose ‘Install app’ or ‘Add to Home screen’." : "Open this page in Microsoft Edge or Chrome for Windows. Use the install icon in the address bar or choose ‘Apps’ → ‘Install this site as an app’ from the menu."}</p><p>Installation on localhost depends on the browser. Serve the site over HTTPS to install it on other devices.</p></section></div>}
    <SiteFooter />
  </main>;
}
