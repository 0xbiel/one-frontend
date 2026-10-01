import { useEffect, useState } from "react";
import { ArrowRight, Camera, Heart, House, MessageCircle, ScanLine, ShieldCheck, Smartphone, Users, Wifi } from "lucide-react";
import "./siteHome.css";

export function SiteHome() {
  return <>
    <section className="one-public-hero">
      <div className="one-public-hero-copy">
        <h1>Care,<br />closer to home.</h1>
        <p>ONE brings together home maps, camera views, check-ins, and family access. Features depend on each home’s setup and permissions.</p>
      </div>
      <div className="one-public-hero-graphic" aria-label="Illustrative home overview. This is not live household data.">
        <div className="one-public-graphic-glow" />
        <div className="one-public-graphic-card main"><h3>Home overview</h3><p>Example only · not live household data.</p><div className="one-public-graphic-status"><span><i /> Home map and rooms</span></div><div className="one-public-graphic-status"><span><i /> Check-in answers</span></div></div>
        <div className="one-public-graphic-card float family"><Users size={24} /><strong>Shared care</strong></div>
      </div>
    </section>
    <section className="one-public-audience"><div className="one-public-heading"><h2>Support at home, shared with family.</h2></div><div className="one-public-audience-grid"><article><Heart /><h3>People at home</h3><p>See home information and check-in answers shared with you.</p></article><article><Users /><h3>Families and caregivers</h3><p>Review shared information according to household permissions.</p></article><article><ShieldCheck /><h3>Care teams</h3><p>Access the home information included in your role.</p></article></div></section>
    <section className="one-public-overview"><div className="one-public-heading"><h2>Home information, in context.</h2></div><div className="one-public-pillars">
      <article><House /><h3>Home map</h3><p>Rooms and connected devices share a reference. Locations are approximate.</p></article>
      <article><Camera /><h3>Camera observations</h3><p>When configured, connected cameras can provide observations with approximate room context.</p></article>
      <article><MessageCircle /><h3>Check-ins</h3><p>Review submitted answers and response times. Changes need human review.</p></article>
    </div></section>
    <section className="one-public-band"><div><h2>Tools for care at home.</h2><p>Review maps, camera views, questions, and check-ins in ONE.</p><small>The Hub image is a hardware concept.</small></div><img src="/product-assets/hub-product-v3.png" alt="Illustrative concept rendering of a home display" /></section>
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
    <section className="one-how-context"><div><h2>Response time needs human context.</h2><p>Review check-in response times alongside other home information. A change needs human review.</p></div><div className="one-how-chart" aria-label="Illustrative response-time sample, not live household data"><div className="one-how-chart-top"><span>Response time · sample data · not live</span></div><div className="one-how-bars">{[38,48,42,68,52,73,58].map((height,index) => <div key={index}><i style={{height: height + "%"}} /><small>{["M","T","W","T","F","S","S"][index]}</small></div>)}</div></div></section>
    <section className="one-how-signals"><div className="one-public-heading"><h2>Available information</h2></div><div className="one-how-signals-grid"><article><House/><h3>Home map</h3><p>Review rooms linked to home information and connected devices. Locations are approximate.</p></article><article><Camera/><h3>Camera views</h3><p>Review connected camera views and available events according to household permissions.</p></article><article><MessageCircle/><h3>Check-ins</h3><p>Review submitted answers and response times. A person decides what follow-up is appropriate.</p></article></div></section>
  </>;
}
