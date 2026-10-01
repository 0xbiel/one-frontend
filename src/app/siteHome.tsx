import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, Heart, House, MapPin, MessageCircle, ScanLine, Smartphone, Wifi } from "lucide-react";
import { SampleCheckinChat, SampleHomeMap2D } from "./marketingDemos";
import "./siteHome.css";
import "./siteHomeExperience.css";

const homeProducts = [
  { name: "ONE Hub", to: "/products/hub", image: "/product-assets/hub-product-v3.png", description: "A display concept for home information." },
  { name: "Standing Camera", to: "/products/camera", image: "/product-assets/camera-anatomy/standing-camera.webp", description: "An indoor camera for the home." },
  { name: "Wall Camera", to: "/products/exterior", image: "/product-assets/camera-anatomy/wall-camera.webp", description: "A wall-mounted camera for the home." },
  { name: "ONE Band", to: "/products/band", image: "/product-assets/companion-devices/one-band.png", description: "A woven wearable concept with a compact sensor." },
  { name: "ONE Home Speaker", to: "/products/home-speaker", image: "/product-assets/companion-devices/one-home-speaker.png", description: "A fabric speaker concept with simple controls." },
  { name: "ONE Wall Speaker", to: "/products/wall-speaker", image: "/product-assets/companion-devices/one-wall-speaker.png", description: "A compact wall-mounted audio concept." },
  { name: "ONE Family", to: "/products/family", image: "/one-app-icon-512.png", description: "Shared information for people with access." },
];

function HomeSystemPreview() {
  const [view, setView] = useState<"map" | "check-in">("map");
  const [room, setRoom] = useState("living");
  const rooms = [
    { id: "bedroom", name: "Bedroom", status: "Manuel located · resting" },
    { id: "bath", name: "Bath", status: "Room camera connected" },
    { id: "living", name: "Living room", status: "Mug last seen · side table" },
    { id: "kitchen", name: "Kitchen", status: "Keys last seen · counter" },
  ];
  const activeRoom = rooms.find(item => item.id === room) ?? rooms[0];

  return <div className="one-public-system-preview">
    <div className="one-public-preview-topline"><strong>ONE HOME</strong></div>
    <div className="one-public-preview-tabs" role="tablist" aria-label="Home screens">
      <button type="button" role="tab" aria-selected={view === "map"} onClick={() => setView("map")}>Home map</button>
      <button type="button" role="tab" aria-selected={view === "check-in"} onClick={() => setView("check-in")}>Check-in</button>
    </div>
    {view === "map" ? <div className="one-public-map-panel" role="tabpanel">
      <div className="one-public-map-visual"><SampleHomeMap2D selectedRoom={room} onSelectRoom={setRoom} /></div>
      <div className="one-public-map-rooms" aria-label="Choose a room">
        {rooms.map(item => <button type="button" key={item.id} aria-pressed={room === item.id} onClick={() => setRoom(item.id)}>{item.name}</button>)}
      </div>
      <div className="one-public-map-selected" role="status"><MapPin size={16} /><strong>{activeRoom.status}</strong><span>{activeRoom.name}</span></div>
    </div> : <div className="one-public-chat-panel" role="tabpanel"><SampleCheckinChat compact /></div>}
  </div>;
}

export function SiteHome() {
  return <>
    <section className="one-public-hero">
      <div className="one-public-hero-copy">
        <h1>Care, closer to home.</h1>
        <p>Home maps, camera views, check-ins, and shared information in one place. What is available depends on each home’s setup and permissions.</p>
        <div className="one-public-actions"><Link to="/products" className="one-public-primary">Explore products <ArrowRight size={17} /></Link><Link to="/how-it-works" className="one-public-secondary">How it works</Link></div>
      </div>
      <HomeSystemPreview />
    </section>
    <section className="one-public-products"><div className="one-public-products-heading"><h2>One connected home</h2><Link to="/products">View all products <ArrowRight size={16} /></Link></div><div className="one-public-product-row">{homeProducts.map(product => <Link to={product.to} key={product.name} className="one-public-product"><span className="one-public-product-image"><img src={product.image} alt={`${product.name} concept`} /></span><strong>{product.name}</strong><small>{product.description}</small><span className="one-public-product-explore">Explore <ArrowRight size={15} /></span></Link>)}</div></section>
    <section className="one-public-sharing"><div><h2>Shared with clear boundaries.</h2><p>People see information according to household permissions. Camera and microphone access require separate consent. ONE organizes information for people to review; it does not provide a medical diagnosis.</p></div><Link to="/technology" aria-label="Explore technology and permissions">Explore Technology <ArrowRight size={16} /></Link></section>
  </>;
}

const steps = [
  { icon: Smartphone, title: "Create a map of the home", text: "Add rooms to the home map. Setup depends on the tools available for each home." },
  { icon: Wifi, title: "Connect cameras and assign rooms", text: "Supported cameras can be associated with rooms. Hub images on this site are hardware concepts." },
  { icon: ScanLine, title: "Review observations in context", text: "View available camera observations alongside a home map. Room context is approximate." },
  { icon: MessageCircle, title: "Use questions and check-ins", text: "Review submitted answers and response times. They are not a medical diagnosis." },
  { icon: Heart, title: "Share information with caregivers", text: "People with access can review information allowed by household permissions." },
];

export function HowItWorksPage() {
  const [active, setActive] = useState(0);
  const Icon = steps[active].icon;
  useEffect(() => {
    const chart = document.querySelector<HTMLElement>(".one-how-chart");
    if (!chart) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      chart.classList.add("is-visible");
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      chart.classList.add("is-visible");
      observer.disconnect();
    }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  return <>
    <section className="one-how-hero"><div><h1>How ONE works</h1><p>Home maps, connected cameras, and check-ins appear together for people with access.</p></div><div className="one-how-diagram" aria-label="Illustration of a home map, Hub concept, cameras, and family access"><div className="one-how-house"><House size={90} strokeWidth={1.2} /><span>ONE HOME</span></div><div className="one-how-orbit one-how-orbit-a"><Smartphone /><small>Map</small></div><div className="one-how-orbit one-how-orbit-b"><Wifi /><small>Hub concept</small></div><div className="one-how-orbit one-how-orbit-c"><Camera /><small>Cameras</small></div><div className="one-how-orbit one-how-orbit-d"><Heart /><small>Family</small></div></div></section>
    <section id="one-how-steps" className="one-how-steps"><div className="one-how-layout"><nav aria-label="System steps">{steps.map((step, index) => { const StepIcon = step.icon; return <button key={step.title} onClick={() => setActive(index)} className={active === index ? "active" : ""} aria-current={active === index ? "step" : undefined}><b>0{index + 1}</b><StepIcon size={21} /><span>{step.title}</span><ArrowRight size={16} /></button>; })}</nav><article className="one-how-step-card"><div className="one-how-step-icon"><Icon size={46} strokeWidth={1.4} /></div><h3>{steps[active].title}</h3><p>{steps[active].text}</p></article></div></section>
    <section className="one-how-context"><div><h2>Response time needs human context.</h2><p>Review check-in response times alongside other home information. A change needs human review.</p></div><div className="one-how-chart" aria-label="Illustration of response times over a week"><div className="one-how-chart-top"><span>Response time · this week</span></div><div className="one-how-bars">{[38,48,42,68,52,73,58].map((height,index) => <div key={index}><i style={{height: height + "%"}} /><small>{["M","T","W","T","F","S","S"][index]}</small></div>)}</div></div></section>
    <section className="one-how-signals"><div className="one-public-heading"><h2>Available information</h2></div><div className="one-how-signals-grid"><article><House/><h3>Home map</h3><p>Review rooms linked to home information and connected devices. Locations are approximate.</p></article><article><Camera/><h3>Camera views</h3><p>Review connected camera views and available events according to household permissions.</p></article><article><MessageCircle/><h3>Check-ins</h3><p>Review submitted answers and response times. A person decides what follow-up is appropriate.</p></article></div></section>
  </>;
}
