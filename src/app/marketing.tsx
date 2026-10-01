import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, ArrowRight, Camera, ChevronDown, ChevronRight,
  Home, LockKeyhole, Mail, Menu, MessageCircle, Search, UserPlus, Users, X,
} from "lucide-react";
import "./marketing.css";
import { HowItWorksPage, SiteHome } from "./siteHome";
import { SampleCheckinChat, SampleHomeMap3D, SampleRouteMap } from "./marketingDemos";
import "./marketingExtra.css";
import "./marketingPolish.css";
import "./marketingExperience.css";
import "./marketingHeader.css";

type ProductId = "hub" | "camera" | "family" | "exterior";

const products = [
  { id: "hub" as const, name: "ONE Hub", description: "A display concept for a more connected view of home information.", image: "/product-assets/hub-product-v3.png" },
  { id: "camera" as const, name: "Standing Camera", description: "An indoor camera concept shown with its proposed components.", image: "/product-assets/camera-anatomy/standing-camera.webp" },
  { id: "exterior" as const, name: "Wall Camera", description: "A wall-mounted camera concept shown with its proposed components.", image: "/product-assets/camera-anatomy/wall-camera.webp" },
  { id: "family" as const, name: "ONE Family", description: "Share the home information available to people with access.", image: "/one-app-icon-512.png" },
];

const supportTopics = [
  { id: "sign-in", title: "Sign in with an email code", group: "Account access", icon: Mail, summary: "Sign in with a one-time six-digit code sent to your email.", keywords: "login sign-in password passcode one-time code six digit email access", destination: "/login", action: "Open sign in", steps: ["Open Sign in and enter the email address on your ONE account.", "Choose Email me a code and check that inbox for a six-digit code.", "Enter the code before it expires to open your care space.", "If the code expires, choose Change email, enter the same address again, and request a fresh code."] },
  { id: "create-space", title: "Create a care space", group: "Account access", icon: Home, summary: "Set up your account and home, then verify the email code.", keywords: "create account register home residence household support focus email verification", destination: "/create-account", action: "Create a care space", steps: ["Enter your name and email on the Create account page.", "Choose a home or residential care setting and add a home name if you want.", "Select the support focus for this care space.", "Enter the one-time code sent to your email to continue setup."] },
  { id: "join-household", title: "Join a household invitation", group: "Account access", icon: UserPlus, summary: "Use the six-digit invitation code supplied by the home admin.", keywords: "join household invitation caregiver resident invite code email access", destination: "/join-household", action: "Join a household", steps: ["Enter your name and the email address the admin invited.", "Enter the six-digit invitation code supplied by the home admin.", "Choose Join household. If the code is invalid or expired, ask the admin for a new one.", "Joining adds your account to the household; camera consent is a separate choice."] },
  { id: "invite-member", title: "Invite someone to a household", group: "Family access", icon: Users, summary: "Admins can create a one-time invitation after household sharing consent is recorded.", keywords: "invite add caregiver family member role invitation access consent code", destination: "/dashboard/family", action: "Open family access", steps: ["Open Family & care team in ONE.", "A household admin can create an invitation when family sharing consent is active.", "Share the one-time invitation code securely. It expires, and the recipient uses it on Join a household.", "A care recipient profile is separate from a household account and does not grant login access."] },
  { id: "camera", title: "Pair a camera", group: "Camera setup", icon: Camera, summary: "Connect a camera with its one-time pairing code and review access prompts.", keywords: "pair pairing code consent microphone", destination: "/dashboard/cameras", action: "Open camera manager", steps: ["In ONE, open Camera Manager and start camera setup.", "Enter the six-digit pairing code shown on the camera device.", "Review camera and microphone consent before enabling either one.", "Finish the optional room walkthrough, or return to it later."] },
  { id: "privacy", title: "Manage camera privacy", group: "Privacy", icon: LockKeyhole, summary: "Review camera consent and pause capture from ONE’s privacy settings.", keywords: "pause capture permissions access", destination: "/dashboard/privacy", action: "Open privacy settings", steps: ["Open Privacy from the ONE dashboard.", "Review the camera and microphone consent settings.", "Use the capture control to pause or resume camera activity.", "When you are ready to allow capture again, choose Resume care."] },
  { id: "map", title: "Review rooms on the home map", group: "Home map", icon: Home, summary: "Open the floor plan and check the rooms linked to camera observations.", keywords: "floor plan room location map", destination: "/dashboard/map", action: "Open home map", steps: ["Open Map from the ONE dashboard.", "Select a room to review the devices linked to it.", "Camera locations are approximate and depend on the home setup."] },
  { id: "questions", title: "Review check-ins and answers", group: "Questions", icon: MessageCircle, summary: "Find check-in answers and response times for family review.", keywords: "check in questions answers response time", destination: "/dashboard/questions", action: "Open questions", steps: ["Open Questions from the ONE dashboard.", "Choose a check-in to review its answer and response time.", "Use changes as a prompt for human review, not as a diagnosis."] },
  { id: "family", title: "Review shared family information", group: "Family", icon: Users, summary: "Open summaries and observations available to your account.", keywords: "family caregiver sharing summary access", destination: "/dashboard/family", action: "Open family", steps: ["Open Family from the ONE dashboard.", "Review the summaries and observations available to your role.", "Ask the household administrator to update access if something is missing."] },
] as const;

function ProductLink({ id, children, className = "", ariaCurrent, onClick, onFocus }: { id: ProductId; children: React.ReactNode; className?: string; ariaCurrent?: "page"; onClick?: React.MouseEventHandler<HTMLAnchorElement>; onFocus?: React.FocusEventHandler<HTMLAnchorElement> }) {
  return <Link className={className} to={`/products/${id}`} aria-current={ariaCurrent} onClick={onClick} onFocus={onFocus}>{children}</Link>;
}

export function SiteHeader({ section }: { section: string }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 2);
    };
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);
  const items = [
    { label: "Home", to: "/", active: section === "home" },
    { label: "Products", to: "/products", active: section === "products" || section === "detail" },
    { label: "How it works", to: "/how-it-works", active: section === "how" },
    { label: "Technology", to: "/technology", active: section === "technology" },
    { label: "Support", to: "/support", active: section === "support" },
    { label: "ONE app", to: "/app", active: section === "app" },
  ];
  const productLinks: { id: ProductId; label: string }[] = [
    { id: "hub", label: "ONE Hub" },
    { id: "camera", label: "Standing Camera" },
    { id: "exterior", label: "Wall Camera" },
    { id: "family", label: "ONE Family" },
  ];
  const closeMenus = () => {
    setMenuOpen(false);
    setProductMenuOpen(false);
  };
  return <header className={["one-site-header", isScrolled && "is-scrolled"].filter(Boolean).join(" ")}>
    <div className="one-site-header-main">
      <Link to="/" className="one-site-logo" aria-label="ONE home"><img src="/one-logo.png" alt="" /><span>one</span></Link>
      <nav className={menuOpen ? "one-site-nav open" : "one-site-nav"} aria-label="Main navigation">
        {items.map(item => item.label === "Products" ? <div
          key={item.label}
          className={`one-site-nav-products${productMenuOpen ? " is-open" : ""}`}
          onPointerEnter={event => {
            if (event.pointerType !== "touch") setProductMenuOpen(true);
          }}
          onPointerLeave={event => {
            if (event.pointerType !== "touch" && !event.currentTarget.contains(document.activeElement)) setProductMenuOpen(false);
          }}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProductMenuOpen(false);
          }}
        >
          <div className="one-site-nav-products-trigger">
            <Link
              className={item.active ? "active" : ""}
              to={item.to}
              onClick={closeMenus}
              onFocus={() => setProductMenuOpen(true)}
              aria-expanded={productMenuOpen}
              aria-controls="one-site-product-subnav"
            >{item.label}<ChevronDown size={14} aria-hidden="true" /></Link>
            <button
              type="button"
              className="one-site-products-menu-toggle"
              onClick={() => setProductMenuOpen(value => !value)}
              aria-label={productMenuOpen ? "Hide product pages" : "Show product pages"}
              aria-expanded={productMenuOpen}
              aria-controls="one-site-product-subnav"
            ><ChevronDown size={16} aria-hidden="true" /></button>
          </div>
          <div
            id="one-site-product-subnav"
            className="one-site-product-subnav"
            role="group"
            aria-label="Product pages"
            aria-hidden={!productMenuOpen}
          >
            {productLinks.map(product => {
              const active = location.pathname === `/products/${product.id}`;
              return <ProductLink
                key={product.id}
                id={product.id}
                className={active ? "active" : ""}
                ariaCurrent={active ? "page" : undefined}
                onClick={closeMenus}
                onFocus={() => setProductMenuOpen(true)}
              >{product.label}<ArrowRight size={14} aria-hidden="true" /></ProductLink>;
            })}
          </div>
        </div> : <Link key={item.label} className={item.active ? "active" : ""} to={item.to} onClick={closeMenus}>{item.label}</Link>)}
      </nav>
      <div className="one-site-actions"><Link className="one-site-register" to="/create-account">Create account</Link><Link className="one-site-pill primary" to="/login">Sign in <ArrowRight size={16} /></Link></div>
      <button className="one-site-menu" onClick={() => { setMenuOpen(value => !value); setProductMenuOpen(false); }} aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X /> : <Menu />}</button>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="one-site-footer">
    <div className="one-site-footer-brand"><Link to="/" aria-label="ONE home">one</Link></div>
    <nav aria-label="Legal documents"><a href="/legal/privacy-notice.html#privacy">Privacy notice</a><a href="/legal/privacy-notice.html#terms">Terms of use</a></nav>
  </footer>;
}

function ProductCard({ id }: { id: ProductId }) {
  const product = products.find(item => item.id === id)!;
  return <article className={`one-site-product-card one-site-card-${id}`}>
    <ProductLink id={id} className="one-site-card-media"><img className="one-site-card-photo" src={product.image} alt={`${product.name} concept`} /></ProductLink>
    <div className="one-site-card-copy"><h3>{product.name}</h3><p>{product.description}</p>
      <ProductLink id={id} className="one-site-card-link">Explore <ArrowRight size={16} /></ProductLink>
    </div>
  </article>;
}

type ProductNeighbor = { id: ProductId; label: string };

function ProductNeighborNav({ previous, next }: { previous?: ProductNeighbor; next?: ProductNeighbor }) {
  return <nav className="one-site-product-neighbors" aria-label="Explore nearby products">
    {previous ? <ProductLink id={previous.id} className="one-site-product-neighbor previous"><ArrowLeft size={17} /><span><small>Previous</small>{previous.label}</span></ProductLink> : <span />}
    {next ? <ProductLink id={next.id} className="one-site-product-neighbor next"><span><small>Next</small>{next.label}</span><ArrowRight size={17} /></ProductLink> : <span />}
  </nav>;
}

function ProductsPage() {
  const ids: ProductId[] = ["hub", "camera", "exterior", "family"];
  return <>
    <section className="one-site-products-hero">
      <div className="one-site-products-intro"><h1>Products</h1></div>
    </section>
    <section className="one-site-products-section">
      <div className="one-site-card-grid">{ids.map(id => <ProductCard key={id} id={id} />)}</div>
      <div className="one-site-product-system-note">
        <span className="eyebrow">ONE AT HOME</span>
        <h2>One system, working together.</h2>
        <p>ONE Hub brings shared home information into view. Room cameras add context, check-ins keep a familiar daily rhythm, and ONE Family helps the people around someone stay connected.</p>
      </div>
    </section>
  </>;
}

type ProductPart = { name: string; image: string; description: string };

function ProductAnatomySequence({ name, parts, overviewSrc, overviewAlt, overviewLayout = "portrait" }: { name: string; parts: readonly ProductPart[]; overviewSrc: string; overviewAlt: string; overviewLayout?: "portrait" | "landscape" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const partCount = parts.length;
  const activePart = parts[activeIndex];

  useEffect(() => {
    const updateActivePart = () => {
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!track || !stage || partCount < 1) return;
      const trackTop = window.scrollY + track.getBoundingClientRect().top;
      const scrollRange = Math.max(track.offsetHeight - stage.offsetHeight, 1);
      const progress = Math.min(1, Math.max(0, (window.scrollY - trackTop) / scrollRange));
      const nextIndex = Math.min(partCount - 1, Math.floor(progress * partCount));
      setActiveIndex(current => current === nextIndex ? current : nextIndex);
    };
    updateActivePart();
    window.addEventListener("scroll", updateActivePart, { passive: true });
    window.addEventListener("resize", updateActivePart);
    return () => {
      window.removeEventListener("scroll", updateActivePart);
      window.removeEventListener("resize", updateActivePart);
    };
  }, [partCount]);

  const goToPart = (index: number) => {
    if (index < 0 || index >= parts.length) return;
    setActiveIndex(index);
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    const trackTop = window.scrollY + track.getBoundingClientRect().top;
    const scrollRange = Math.max(track.offsetHeight - stage.offsetHeight, 1);
    const target = trackTop + ((index + 0.5) / parts.length) * scrollRange;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
  };

  if (!activePart) return null;
  return <section className="one-product-anatomy" aria-label={`${name} concept breakdown`}>
    <div className="one-product-anatomy-heading"><h2>Inside the concept</h2></div>
    <div className="one-product-anatomy-track" ref={trackRef} style={{ "--part-count": parts.length, "--part-scroll-height": `${parts.length * 52}svh` } as React.CSSProperties}>
      <article className="one-product-anatomy-stage" ref={stageRef} tabIndex={0} aria-live="polite" onKeyDown={event => {
        if (event.key === "ArrowRight") goToPart(activeIndex + 1);
        if (event.key === "ArrowLeft") goToPart(activeIndex - 1);
      }}>
        <div className="one-product-anatomy-visual"><img key={activePart.image} src={activePart.image} alt={`${activePart.name}, a proposed ${name} component`} /></div>
        <div className="one-product-anatomy-copy">
          <span className="one-product-anatomy-count">{String(activeIndex + 1).padStart(2, "0")} / {String(parts.length).padStart(2, "0")}</span>
          <h3 key={activePart.name}>{activePart.name}</h3>
          <p>{activePart.description}</p>
          <nav className="one-product-anatomy-part-list" aria-label={`${name} components`}>
            {parts.map((part, index) => <button key={part.name} type="button" className={index === activeIndex ? "active" : ""} aria-current={index === activeIndex ? "step" : undefined} onClick={() => goToPart(index)}><span>{String(index + 1).padStart(2, "0")}</span>{part.name}</button>)}
          </nav>
          <nav className="one-product-anatomy-controls" aria-label={`${name} component sequence`}>
            <button type="button" onClick={() => goToPart(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous component"><ArrowLeft size={17} /></button>
            <button type="button" onClick={() => goToPart(activeIndex + 1)} disabled={activeIndex === parts.length - 1} aria-label="Next component"><ArrowRight size={17} /></button>
          </nav>
        </div>
      </article>
    </div>
    <div className={`one-product-anatomy-overview is-${overviewLayout}`}>
      <div className="one-product-anatomy-overview-list"><span className="eyebrow">COMPONENTS</span><ol>{parts.map((part, index) => <li key={part.name}><span>{String(index + 1).padStart(2, "0")}</span>{part.name}</li>)}</ol></div>
      <img src={overviewSrc} alt={overviewAlt} loading="lazy" />
    </div>
  </section>;
}

const detailCopy = {
  hub: {
    title: "ONE Hub",
    description: "A home display concept for bringing shared home information into one place.",
    image: "/product-assets/hub-product-v3.png",
    imageAlt: "Illustrative ONE Hub display concept",
    exploded: "/product-assets/hub-internals-v3.png",
    parts: [
      { name: "Display", image: "/product-assets/hub-anatomy/display.webp", description: "The screen is the main surface for viewing check-ins, household updates, and information shared by caregivers." },
      { name: "Inner chassis", image: "/product-assets/hub-anatomy/inner-chassis.webp", description: "This internal frame supports the display and keeps the proposed electronics aligned inside the Hub." },
      { name: "Circuit board", image: "/product-assets/hub-anatomy/circuit-board.webp", description: "The board represents the central electronics that would coordinate the display and connected home features." },
      { name: "Chip", image: "/product-assets/hub-anatomy/chip.webp", description: "The processor concept is shown separately from the board to make the computing layer easier to identify." },
      { name: "Metal support", image: "/product-assets/hub-anatomy/metal-support.webp", description: "A rigid support holds the screen and internal components in the proposed tabletop arrangement." },
      { name: "Accent ring", image: "/product-assets/hub-anatomy/accent-ring.webp", description: "The ring is an exterior detail around the speaker area and forms part of the Hub’s visual identity." },
      { name: "Speaker", image: "/product-assets/hub-anatomy/speaker.webp", description: "The speaker represents a way the Hub could provide audible prompts and spoken check-in responses." },
      { name: "Textile shell", image: "/product-assets/hub-anatomy/textile-shell.webp", description: "The fabric-covered housing surrounds the lower body and gives the concept a softer finish for the home." },
    ],
  },
} as const;

function DetailPage({ device }: { device: "hub" }) {
  const details = detailCopy[device];
  return <>
    <section className="one-camera-hero one-hub-hero">
      <div className="one-camera-hero-copy"><h1>{details.title}</h1><p>{details.description}</p><p className="one-camera-concept-note">Illustrative hardware concept. Final design and specifications are not confirmed.</p></div>
      <div className="one-camera-hero-image"><img src={details.image} alt={details.imageAlt} /></div>
    </section>
    <ProductAnatomySequence name="ONE Hub" parts={details.parts} overviewSrc={details.exploded} overviewAlt="Exploded illustrative rendering of the ONE Hub concept and its proposed components" />
    <ProductNeighborNav next={{ id: "camera", label: "Standing Camera" }} />
  </>;
}

function AdditionalProductPage() {
  return <>
    <section className="one-extra-product-hero"><div><h1>ONE Family</h1><p>Share the home information available to people with access.</p></div><img src="/one-app-icon-512.png" alt="ONE Family app icon" /></section>
    <section className="one-extra-product-details"><h2>Shared access</h2><div>{[["Shared summaries", "Review home information available to your account."], ["Shared care", "People with access can see information relevant to their role."], ["Human review", "Use observations as context for a conversation or professional review."]].map(([heading, description], index) => <article key={heading}><b>0{index + 1}</b><h3>{heading}</h3><p>{description}</p></article>)}</div></section>
    <ProductNeighborNav previous={{ id: "exterior", label: "Wall Camera" }} />
  </>;
}

const cameraConcepts = {
  standing: {
    name: "Standing Camera",
    description: "A freestanding indoor camera concept, shown as a complete render and component study.",
    complete: "/product-assets/camera-anatomy/standing-camera.webp",
    exploded: "/product-assets/camera-anatomy/standing-exploded.webp",
    parts: [
      { name: "Front panel", image: "standing-front-panel.webp", description: "The front face frames the optical opening and indicator while forming the camera’s clean, approachable front surface." },
      { name: "Lens elements", image: "standing-lens-elements.webp", description: "Layered lens elements focus incoming light before it reaches the image sensor." },
      { name: "Optical module", image: "standing-optical-module.webp", description: "The optical assembly holds the lens in alignment and directs the view toward the sensor." },
      { name: "Sensor and board", image: "standing-sensor-board.webp", description: "This assembly represents the image sensor and supporting electronics behind the camera view." },
      { name: "Privacy shutter", image: "standing-privacy-shutter.webp", description: "The proposed shutter gives a visible hardware way to cover the lens when camera access is paused." },
      { name: "Outer enclosure", image: "standing-enclosure.webp", description: "The rounded outer shell protects the camera assembly and gives the standing camera its compact form." },
      { name: "Adjustable joint", image: "standing-adjustable-joint.webp", description: "The joint connects the camera body to its stand and allows its angle to be adjusted around the room." },
      { name: "Base", image: "standing-base.webp", description: "The weighted base supports the camera on a table or shelf and helps keep the view steady." },
    ],
  },
  wall: {
    name: "Wall Camera",
    description: "A wall-mounted camera concept, shown as a complete render and component study.",
    complete: "/product-assets/camera-anatomy/wall-camera.webp",
    exploded: "/product-assets/camera-anatomy/wall-exploded.webp",
    parts: [
      { name: "Front panel", image: "wall-front-panel.webp", description: "The front face protects the opening and places the lens behind a single, weather-conscious surface." },
      { name: "Lens elements", image: "wall-lens-elements.webp", description: "Layered lenses focus the scene before the light reaches the image sensor." },
      { name: "Optical module", image: "wall-optical-module.webp", description: "The optical assembly keeps the lens aligned inside the mounted camera body." },
      { name: "Image sensor", image: "wall-sensor.webp", description: "The sensor converts the incoming view into image data for an available camera stream." },
      { name: "Circuit board", image: "wall-board.webp", description: "The electronics board supports the sensor and camera connection in this hardware concept." },
      { name: "Gasket", image: "wall-gasket.webp", description: "A sealing layer sits between the front and the enclosure to help protect the internal assembly." },
      { name: "Outer enclosure", image: "wall-enclosure.webp", description: "The enclosure covers the internal components and is shaped for a fixed wall-mounted position." },
      { name: "Wall mount", image: "wall-mount.webp", description: "The bracket attaches the camera to a wall and sets its position toward an entry or outdoor area." },
    ],
  },
} as const;

function CameraConceptPage({ model }: { model: "standing" | "wall" }) {
  const camera = cameraConcepts[model];
  const previous = model === "standing" ? { id: "hub" as const, label: "ONE Hub" } : { id: "camera" as const, label: "Standing Camera" };
  const next = model === "standing" ? { id: "exterior" as const, label: "Wall Camera" } : { id: "family" as const, label: "ONE Family" };

  return <>
    <section className={`one-camera-hero one-camera-hero-${model}`}>
      <div className="one-camera-hero-copy">
        <h1>{camera.name}</h1>
        <p>{camera.description}</p>
        <p className="one-camera-concept-note">Hardware concept. Final design, specifications, and availability are not confirmed.</p>
      </div>
      <div className="one-camera-hero-image"><img src={camera.complete} alt={`${camera.name} hardware concept render`} /></div>
    </section>
    <ProductAnatomySequence name={camera.name} parts={camera.parts.map(part => ({ ...part, image: `/product-assets/camera-anatomy/${part.image}` }))} overviewSrc={camera.exploded} overviewAlt={`Exploded view of the ${camera.name} concept, showing its proposed components`} overviewLayout={model === "wall" ? "landscape" : "portrait"} />
    <ProductNeighborNav previous={previous} next={next} />
  </>;
}

function TechnologyPage() {
  const [layer, setLayer] = useState(0);
  const capabilities = [
    { name: "Home map", icon: Home, text: "Review the floor plan and rooms linked to a home.", detail: "Camera locations and movement context are approximate and depend on the home setup.", destination: "/dashboard/map", action: "Open home map" },
    { name: "Camera views", icon: Camera, text: "View connected cameras and review available events.", detail: "Camera access follows household permissions, and video or microphone access requires consent.", destination: "/dashboard/cameras", action: "Open cameras" },
    { name: "Check-ins", icon: MessageCircle, text: "Review questions, answers, and response times.", detail: "Check-ins support human review. They do not provide a medical diagnosis.", destination: "/dashboard/questions", action: "Open questions" },
    { name: "Family access", icon: Users, text: "Share household information with people who have access.", detail: "Each person sees information according to the access configured for the household.", destination: "/dashboard/family", action: "Open family" },
  ];
  return <>
    <section className="one-site-tech-hero"><div className="one-site-tech-copy"><h1>One view of care at home.</h1><p>Home maps, connected camera views, check-ins, and family access, based on each household’s setup and permissions.</p></div><div className="one-site-tech-visual"><img src="/product-assets/hub-product-v3.png" alt="Illustrative ONE Hub display concept" /><img src="/product-assets/camera-anatomy/standing-camera.webp" alt="Illustrative standing camera concept" /></div><p className="one-site-tech-note">Hardware images are concepts. Final specifications are not confirmed.</p></section>
    <section className="one-site-tech-layers"><div className="one-site-section-heading"><h2>Explore app features</h2></div><div className="one-site-layer-cards">{capabilities.map((item, index) => { const Icon = item.icon; return <button className={index === layer ? "active" : ""} key={item.name} onClick={() => setLayer(index)} aria-pressed={index === layer}><span><Icon size={30} /></span><strong>{item.name}</strong><p>{item.text}</p></button>; })}</div><div className="one-site-layer-explain"><h3>{capabilities[layer].name}</h3><p>{capabilities[layer].detail}</p><Link to={capabilities[layer].destination}>{capabilities[layer].action} <ArrowRight size={15} /></Link></div><p className="one-site-tech-limits">ONE organizes observations for people to review. It does not provide a medical diagnosis or contact emergency services.</p></section>
    <section className="one-tech-checkins">
      <div><h2>A simple check-in</h2><p>Choose a common question to see how a calm, clear response could look.</p></div>
      <SampleCheckinChat />
    </section>
    <section className="one-tech-demos">
      <div className="one-tech-demos-heading"><h2>Maps</h2><p>Explore rooms and follow movement through the home.</p></div>
      <div className="one-tech-demo-grid">
        <article className="one-tech-demo">
          <header><h3>Home map</h3></header>
          <SampleHomeMap3D />
        </article>
        <article className="one-tech-demo">
          <header><h3>Movement route</h3></header>
          <SampleRouteMap />
        </article>
      </div>
    </section>
  </>;
}

function SupportPage() {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("en");
  const matches = supportTopics.filter(topic => [topic.title, topic.group, topic.summary, topic.keywords, ...topic.steps].join(" ").toLocaleLowerCase("en").includes(normalizedQuery));
  const active = supportTopics.find(topic => topic.id === activeTopic);
  const choose = (id: string) => {
    setActiveTopic(id);
    window.setTimeout(() => document.getElementById("support-answer")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }), 0);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (matches.length) choose(matches[0].id);
    else setActiveTopic(null);
  };

  return <>
    <section className="one-site-support-hero">
       <div className="one-site-support-copy"><h1>How can we help?</h1></div>
       <form className="one-site-support-search" onSubmit={submit}>
         <Search size={24} />
         <input value={query} onChange={event => { setQuery(event.target.value); setSubmitted(false); setActiveTopic(null); }} placeholder="Search guides" aria-label="Search support guides" />
        {query && <button type="button" className="one-site-search-clear" onClick={() => { setQuery(""); setSubmitted(false); setActiveTopic(null); }} aria-label="Clear search"><X size={17} /></button>}
        <button type="submit" aria-label="Search support guides">Search <ArrowRight size={17} /></button>
      </form>
       {query && <div className="one-site-search-results" aria-live="polite"><span>{matches.length ? `${matches.length} result${matches.length === 1 ? "" : "s"}` : "No results"}</span>{matches.map(topic => <button key={topic.id} onClick={() => choose(topic.id)} aria-expanded={activeTopic === topic.id}>{topic.title}<ChevronRight size={16} /></button>)}{submitted && !matches.length && <p>Try “pairing code”, “privacy”, “map”, or “check-in”.</p>}</div>}
     </section>
     <section className="one-site-support-content">
       <div className="one-site-section-heading"><div><h2>Guides</h2></div></div>
      <div className="one-site-support-topic-grid">{supportTopics.map(topic => { const Icon = topic.icon; return <button key={topic.id} onClick={() => choose(topic.id)} aria-expanded={activeTopic === topic.id} aria-controls="support-answer"><span className="one-site-topic-icon"><Icon size={27} /></span><strong>{topic.title}</strong><p>{topic.summary}</p><span className="one-site-topic-arrow"><ArrowRight size={17} /></span></button>; })}</div>
       {active && <article id="support-answer" className="one-site-answer"><button className="one-site-answer-close" onClick={() => setActiveTopic(null)} aria-label="Close guide"><X size={20} /></button><h2>{active.title}</h2><ol>{active.steps.map(step => <li key={step}>{step}</li>)}</ol><Link to={active.destination} className="one-site-button primary">{active.action} <ArrowRight size={16} /></Link></article>}
    </section>
  </>;
}

export function MarketingSite() {
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [location.pathname, location.search]);
  const isDetail = ["/products/hub", "/products/camera", "/products/family", "/products/exterior"].includes(location.pathname);
  const section = location.pathname === "/" ? "home" : location.pathname === "/how-it-works" ? "how" : location.pathname === "/technology" ? "technology" : location.pathname === "/support" ? "support" : isDetail ? "detail" : "products";
  return <main className={`one-site one-site-${section}`}>
    <SiteHeader section={section} />
    {section === "home" ? <SiteHome /> : section === "how" ? <HowItWorksPage /> : section === "products" ? <ProductsPage /> : section === "detail" ? location.pathname === "/products/camera" ? <CameraConceptPage model="standing" /> : location.pathname === "/products/exterior" ? <CameraConceptPage model="wall" /> : location.pathname.endsWith("/family") ? <AdditionalProductPage /> : <DetailPage device="hub" /> : section === "technology" ? <TechnologyPage /> : <SupportPage key={location.pathname} />}
    <div id="site-footer"><SiteFooter /></div>
    <button className="one-site-back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top"><ArrowDown size={19} /></button>
  </main>;
}


