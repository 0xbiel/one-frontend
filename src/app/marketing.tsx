import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, ArrowRight, BookOpen, BrainCircuit, Camera,
  Check, ChevronRight, CircleHelp, Cpu, Heart, Home, LockKeyhole,
  Menu, MessageCircle, Play, Search, Settings, ShieldCheck, Smartphone,
  Sparkles, Video, Wifi, X,
} from "lucide-react";
import "./marketing.css";
import { HowItWorksPage, SiteHome } from "./siteHome";
import "./productScroll.css";
import "./marketingExtra.css";

type ProductId = "hub" | "camera" | "family" | "exterior";

const products = [
  { id: "hub" as const, name: "ONE Hub", eyebrow: "HOGAR CONECTADO", headline: "El corazón de un hogar más conectado", description: "Conecta, coordina y simplifica el cuidado de tu hogar.", image: "/product-assets/hub-tablet.png", icon: Wifi, traits: ["Conecta tus dispositivos", "Protege tu información", "Simplifica tu día a día"] },
  { id: "camera" as const, name: "Cámaras", eyebrow: "SEGURIDAD EN CASA", headline: "Una mirada que te acerca", description: "Ve lo importante, siempre que lo necesites.", image: "/product-assets/camera.png", icon: Camera, traits: ["Vídeo en alta definición", "Visión nocturna", "Privacidad en tus manos"] },
  { id: "family" as const, name: "ONE Family", eyebrow: "CUIDADO COMPARTIDO", headline: "Más cerca, siempre", description: "Tu familia, informada y en sintonía.", image: "/product-assets/family.png", icon: Heart, traits: ["Todo tu hogar", "Cuidado compartido", "Más tranquilidad"] },
  { id: "exterior" as const, name: "Cámara Exterior", eyebrow: "EXTERIORES", headline: "Tranquilidad más allá de tus paredes", description: "Protección para los espacios que más te importan.", image: "/product-assets/camera-at-home.png", icon: ShieldCheck, traits: ["Resistente al clima", "Visión nocturna", "Alertas en tiempo real"] },
];

const supportTopics = [
  { id: "hub", title: "Configurar ONE Hub", group: "Hub", icon: Settings, summary: "Conecta el Hub, comprueba la red y vincúlalo a tu hogar.", steps: ["Enchufa ONE Hub y espera a que se ilumine.", "Abre Mi ONE e inicia la vinculación.", "Comprueba que el Hub y el móvil estén en la misma red."] },
  { id: "camera", title: "Instalar una cámara", group: "Cámara", icon: Camera, summary: "Añade una cámara y confirma que transmite correctamente.", steps: ["Conecta la cámara a la corriente.", "Desde Mi ONE, añade una cámara al hogar.", "Revisa la imagen y decide los permisos de acceso."] },
  { id: "privacy", title: "Privacidad y permisos", group: "Privacidad", icon: LockKeyhole, summary: "Decide qué dispositivos funcionan y quién puede verlos.", steps: ["Abre el panel de privacidad.", "Revisa los dispositivos y sus permisos.", "Pausa la captación cuando lo necesites."] },
  { id: "connection", title: "Resolver un problema de conexión", group: "Conectividad", icon: Wifi, summary: "Comprueba los dispositivos y la red paso a paso.", steps: ["Comprueba que el dispositivo esté encendido.", "Revisa la conexión de red del Hub.", "Reinicia el dispositivo solo si sigue desconectado."] },
  { id: "app", title: "Usar la app ONE", group: "App", icon: Smartphone, summary: "Consulta tu hogar, las notificaciones y los dispositivos.", steps: ["Inicia sesión en Mi ONE.", "Abre el panel del hogar.", "Elige cámaras, mapa, preguntas o privacidad."] },
] as const;

const conceptNames = ["Horizonte", "Estante flotante", "Plano vivo", "Capítulos", "Señales"];
const asset = (name: string) => `/product-assets/${name === "hub" || name === "hub-exploded" ? "hub-tablet" : name}.png`;

function ProductLink({ id, children, className = "" }: { id: ProductId; children: React.ReactNode; className?: string }) {
  const [params] = useSearchParams();
  const suffix = `?v=${params.get("v") || "1"}`;
  return <Link className={className} to={`/products/${id}${suffix}`}>{children}</Link>;
}

function SiteHeader({ section, variant }: { section: string; variant: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const suffix = `?v=${variant}`;
  const items = [
    { label: "Inicio", to: "/", active: section === "home" },
    { label: "Productos", to: `/products${suffix}`, active: section === "products" || section === "detail" },
    { label: "Cómo funciona", to: "/how-it-works", active: section === "how" },
    { label: "Tecnología", to: `/technology${suffix}`, active: section === "technology" },
    { label: "Soporte", to: `/support${suffix}`, active: section === "support" },
    { label: "App ONE", to: "/app", active: false },
  ];
  return <header className="one-site-header">
    <Link to="/" className="one-site-logo" aria-label="ONE, inicio"><img src="/one-logo.png" alt="" /><span>one</span></Link>
    <nav className={menuOpen ? "one-site-nav open" : "one-site-nav"} aria-label="Navegación principal">
      {items.map(item => <Link key={item.label} className={item.active ? "active" : ""} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
    </nav>
    <div className="one-site-actions"><Link className="one-site-register" to="/create-account">Registrarse</Link><Link className="one-site-pill primary" to="/login">Iniciar sesión <ArrowRight size={16} /></Link></div>
    <button className="one-site-menu" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}>{menuOpen ? <X /> : <Menu />}</button>
  </header>;
}

function ConceptFooter({ section, variant, detail }: { section: string; variant: number; detail?: string }) {
  const location = useLocation();
  const base = detail ? `/products/${detail}` : location.pathname;
  return <footer className="one-site-footer">
    <div><strong>one</strong><span>Hogares más humanos gracias a la tecnología.</span></div>
    <nav aria-label="Variantes de diseño"><span>Variantes {section}</span>{conceptNames.map((name, index) => <Link key={name} to={`${base}?v=${index + 1}`} className={variant === index + 1 ? "active" : ""} aria-current={variant === index + 1 ? "page" : undefined} title={name}>{String(index + 1).padStart(2, "0")}</Link>)}</nav>
  </footer>;
}

function ProductIcon({ id }: { id: ProductId | "how" }) {
  if (id === "how") return <BookOpen size={38} strokeWidth={1.6} />;
  if (id === "family") return <img src={asset("family")} alt="" />;
  return <img src={asset(id === "exterior" ? "camera" : id)} alt="" />;
}

function ProductTabs({ variant }: { variant: number }) {
  const entries = [...products.slice(0, 3), { id: "how" as const, name: "Cómo funciona" }];
  return <div className="one-site-product-tabs" aria-label="Explorar productos">{entries.map(entry => entry.id === "how"
    ? <Link key="how" to="/how-it-works" className="one-site-product-tab"><span className="one-site-tab-icon"><ProductIcon id="how" /></span><strong>Cómo funciona</strong></Link>
    : <ProductLink key={entry.id} id={entry.id} className="one-site-product-tab"><span className="one-site-tab-icon"><ProductIcon id={entry.id} /></span><strong>{entry.name}</strong></ProductLink>)}</div>;
}

function ProductCard({ id, featured = false, numbered = false }: { id: ProductId; featured?: boolean; numbered?: boolean }) {
  const product = products.find(item => item.id === id)!;
  const Icon = product.icon;
  return <article className={`one-site-product-card one-site-card-${id} ${featured ? "featured" : ""}`}>
    <div className="one-site-card-copy"><span className="one-site-kicker">{numbered ? `0${products.findIndex(item => item.id === id) + 1} / ` : ""}{product.eyebrow}</span><h3>{product.name}</h3><p>{featured ? product.headline : product.description}</p>
      <ul>{product.traits.slice(0, featured ? 3 : 2).map(trait => <li key={trait}><Icon size={16} />{trait}</li>)}</ul>
      <ProductLink id={id} className="one-site-button light">Conoce más <ArrowRight size={17} /></ProductLink>
    </div><img className="one-site-card-photo" src={product.image} alt={product.name} /><ProductLink id={id} className="one-site-card-cover"><span className="sr-only">Ver información de {product.name}</span></ProductLink>
  </article>;
}

function ProductsPage({ variant }: { variant: number }) {
  const [slide, setSlide] = useState(0);
  const ids: ProductId[] = ["hub", "camera", "exterior", "family"];
  const order = useMemo(() => {
    const initial: ProductId[] = ["hub", "camera", "exterior", "family"];
    return [...initial.slice(slide), ...initial.slice(0, slide)];
  }, [slide]);
  const choose = (id: ProductId) => { setSlide(ids.indexOf(id)); };
  const shift = (step: number) => { const next = (slide + step + 4) % 4; setSlide(next); };
  return <>
    <section className="one-site-products-hero">
      <div className="one-site-products-intro"><span className="one-site-kicker mobile-only">ONE / HOGAR CONECTADO</span><h1>Productos</h1>{variant === 1 || variant === 4 ? <p>Tecnología para un hogar más tranquilo.</p> : null}</div>
      <ProductTabs variant={variant} />
      <div className="one-site-hero-aside"><span>{["Hogares más humanos gracias a la tecnología.", "TECNOLOGÍA QUE CUIDA LO QUE IMPORTA", "HOGAR MÁS CONECTADO MÁS TRANQUILO", "UN HOGAR MÁS TRANQUILO, UNA VIDA MÁS PLENA", "TECNOLOGÍA QUE TE MANTIENE CERCA"][variant - 1]}</span><i /></div>
      {variant === 3 && <div className="one-site-house-art"><img src={asset("connected-house")} alt="Casa conectada con dispositivos ONE" /><span className="signal-dot one" /><span className="signal-dot two" /><span className="signal-dot three" /></div>}
      {variant === 5 && <div className="one-site-signal-line" aria-hidden="true" />}
    </section>
    <section className="one-site-products-section">
      <div className="one-site-section-heading"><div><h2>Conoce mejor nuestros productos</h2>{variant === 1 && <p>Soluciones conectadas para un hogar más seguro, simple y humano.</p>}</div><div className="one-site-carousel-controls"><button onClick={() => shift(-1)} aria-label="Producto anterior"><ArrowLeft /></button><button onClick={() => shift(1)} aria-label="Siguiente producto"><ArrowRight /></button></div></div>
      {variant === 2 ? <div className="one-site-shelf-carousel"><ProductCard id={order[3]} /><ProductCard id={order[0]} featured /><ProductCard id={order[1]} /></div>
        : variant === 4 ? <div className="one-site-editorial-carousel"><ProductCard id={order[3]} /><ProductCard id={order[0]} featured numbered /><ProductCard id={order[1]} numbered /></div>
        : variant === 5 ? <div className="one-site-signal-carousel"><ProductCard id={order[0]} featured /><ProductCard id={order[1]} /></div>
        : <div className={`one-site-card-grid ${variant === 3 ? "blueprint" : ""}`}>{order.map((id, index) => <ProductCard key={id} id={id} featured={variant === 3 || index === 0} />)}</div>}
      <div className="one-site-carousel-dots" aria-label="Elegir producto">{[0, 1, 2, 3].map(index => <button key={index} className={index === slide ? "active" : ""} onClick={() => choose(ids[index])} aria-label={`Mostrar producto ${index + 1}`} />)}</div>
      {variant === 2 && <div className="one-site-benefits"><span><Home /> Hogares más seguros</span><span><Heart /> Familias más conectadas</span><span><Sparkles /> Un futuro más tranquilo</span></div>}
      {variant === 4 && <a className="one-site-scroll-cue" href="#site-footer">Sigue explorando <ArrowDown /></a>}
    </section>
    <section className="one-site-product-guide"><div className="one-site-product-guide-heading"><span className="one-site-kicker">UN SISTEMA, DISTINTAS PIEZAS</span><h2>Descubre qué aporta cada producto.</h2><p>El Hub conecta la experiencia en casa, las cámaras aportan observaciones, y ONE Family permite compartir la información con quienes participan en el cuidado.</p></div><div className="one-site-product-guide-list">{products.map((product, index) => <ProductLink key={product.id} id={product.id} className="one-site-product-guide-row"><span>0{index + 1}</span><img src={product.image} alt="" /><div><h3>{product.name}</h3><p>{product.id === "hub" ? "Pantalla, audio espacial y procesamiento para coordinar preguntas, señales y dispositivos." : product.id === "camera" ? "Imagen y eventos de la vivienda con acceso según los permisos del hogar." : product.id === "family" ? "Resúmenes y tendencias para que la familia acompañe sin observar constantemente." : "Contexto de entradas y exteriores integrado con los eventos de la vivienda."}</p></div><ArrowRight size={22} /></ProductLink>)}</div></section>
  </>;
}

const detailCopy = {
  hub: {
    title: ["ONE Hub", "Tu hogar. Tus datos. Siempre contigo.", "Todo en armonía. En un solo lugar.", "El corazón que conecta tu hogar", "ONE Hub"],
    subtitle: ["El centro de un hogar más humano.", "Inteligencia para un hogar más seguro, privado y en tus manos.", "ONE Hub centraliza, protege y simplifica tu hogar inteligente.", "Inteligencia, privacidad y control. Todo en ONE.", "El centro inteligente de un hogar más simple, seguro y conectado."],
    features: ["Conecta todo", "Inteligencia real", "Diseño atemporal", "Privacidad en tus manos"],
    image: "hub", exploded: "hub-exploded", atHome: "hub-at-home",
  },
  camera: {
    title: ["ONE Camera", "Mira lo importante. Mantén tu privacidad.", "Ver más. Vivir más tranquilo.", "Una mirada más inteligente", "ONE Camera"],
    subtitle: ["Una mirada más humana.", "Una cámara para un hogar más seguro, con privacidad real.", "ONE Camera te ayuda a estar presente en lo que más importa.", "Ve lo importante. Protege lo que te importa.", "Una mirada más inteligente para un hogar más tranquilo."],
    features: ["Vídeo en alta definición", "Visión nocturna", "Privacidad total", "Diseño que se integra"],
    image: "camera", exploded: "camera-exploded", atHome: "camera-at-home",
  },
};

function ScrollExploded({ device }: { device: "hub" | "camera" | "exterior" }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      setProgress(Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - window.innerHeight))));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const frame = Math.min(4, Math.floor(progress * 5));
  const open = frame / 4;
  const isHub = device === "hub";
  const isExterior = device === "exterior";
  const features = isHub
    ? [["Pantalla y cámara frontal", "Preguntas cotidianas, respuestas y videollamadas familiares desde el mismo equipo."], ["Chip de IA de última generación", "Diseñado para coordinar las señales del hogar y el análisis de cada respuesta. El chip final se definirá en el hardware."], ["Audio espacial envolvente", "Un sistema de altavoces para escuchar con claridad avisos, preguntas y voces familiares."], ["Conectividad y privacidad", "Una arquitectura para unir cámaras, mapa, check-ins y familia con permisos configurables."]]
    : isExterior ? [["Carcasa exterior", "Diseñada para la entrada y los espacios exteriores; la resistencia final dependerá del hardware."], ["Óptica de acceso", "Permite revisar el contexto de puertas y accesos desde el espacio familiar."], ["Sensor y procesamiento", "Las observaciones pueden generar avisos para revisión humana cuando se conecten los dispositivos."], ["Conexión y privacidad", "La familia decide quién puede consultar las imágenes y los eventos registrados."]]
    : [["Óptica y lentes", "La vista interior muestra el recorrido de luz y el conjunto óptico de la cámara."], ["Sensor de imagen", "Capta el contexto visual del hogar; la resolución final se confirmará con el hardware."], ["Chip de IA de última generación", "Procesa observaciones y las relaciona con la estancia y la rutina, sin convertirlas en diagnósticos."], ["Audio y privacidad", "El diseño prevé comunicación clara, permisos por familiar y pausa del cuidado desde el panel."]];
  const label = isHub ? "ONE Hub" : isExterior ? "ONE Camera Exterior" : "ONE Camera";
  const frameImage = frame === 0 ? (isHub ? "/product-assets/hub-product-v3.png" : isExterior ? asset("camera-at-home") : asset("camera")) : isHub ? "/product-assets/hub-internals-v3.png" : asset("camera-exploded");
  return <section ref={sectionRef} className="one-scroll-exploded" aria-label={`Componentes de ${label}`}>
    <div className="one-scroll-sticky">
      <div className="one-scroll-copy"><span className="one-site-kicker">DISEÑADO POR DENTRO · DESPLÁZATE PARA EXPLORAR</span><h2>{label}, por dentro.</h2><p>Desplázate para descubrir cada parte y su función.</p><div className="one-scroll-features">{features.map(([title, description], index) => <article key={title} className={frame === index + 1 ? "visible current" : ""}><b>0{index + 1}</b><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></div>
      <div className={`one-scroll-stage one-scroll-frame ${isHub ? "hub" : "camera"} frame-${frame}`}>
        <div className="one-scroll-halo" />
        <img key={frameImage} className="one-scroll-frame-image" src={frameImage} alt={frame === 0 ? label : `Vista conceptual de los componentes de ${label}`} />
        {frame > 0 && <span className="one-scroll-frame-label"><b>0{frame}</b> {features[frame - 1][0]}</span>}
      </div>
      <div className="one-scroll-meter"><span>0{frame + 1}</span><div><i style={{ width: `${Math.round(open * 100)}%` }} /></div><span>05</span></div>
    </div>
  </section>;
}

function DetailPage({ variant, device }: { variant: number; device: "hub" | "camera" }) {
  const details = detailCopy[device];
  const next = device === "hub" ? "camera" : "hub";
  const isEngineering = variant === 5;
  return <>
    <ScrollExploded device={device} />
    <section className="one-site-detail-hero">
      <div className="one-site-detail-copy"><span className="one-site-kicker">{isEngineering ? "CAPÍTULOS DE INGENIERÍA" : device === "hub" ? "ONE HUB" : "ONE CAMERA"}</span><h1>{details.title[variant - 1]}</h1><p className="one-site-detail-subtitle">{details.subtitle[variant - 1]}</p><p>{variant === 1 ? "Conecta. Comprende. Cuida. Tecnología para acompañarte en casa." : "Diseñado para integrarse en tu vida y darte más tranquilidad."}</p><Link className="one-site-button dark" to="/support">Explorar soporte <ArrowRight size={17} /></Link>
        {variant < 4 && <div className="one-site-detail-mini"><span><ShieldCheck size={16} /> Privacidad</span><span><Wifi size={16} /> Conexión</span><span><CircleHelp size={16} /> Ayuda</span></div>}</div>
      <div className="one-site-detail-visual"><img src={asset(variant === 1 || variant === 2 ? details.exploded : variant === 3 ? details.atHome : details.image)} alt={`${device === "hub" ? "ONE Hub" : "ONE Camera"} ${variant <= 2 ? "y sus componentes" : "en el hogar"}`} />{variant === 4 && <div className="one-site-visual-glow" />}</div>
      {variant !== 3 && <div className="one-site-detail-callouts"><span>01 <b>{device === "hub" ? "Conecta" : "Claridad"}</b></span><span>02 <b>{device === "hub" ? "Protege" : "Privacidad"}</b></span><span>03 <b>{device === "hub" ? "Simplifica" : "Confianza"}</b></span></div>}
    </section>
    <section className="one-detail-depth"><div className="one-detail-depth-intro"><span className="one-site-kicker">TECNOLOGÍA EN CONTEXTO</span><h2>{device === "hub" ? "Un centro para hablar, escuchar y comprender el hogar." : "Una cámara que aporta contexto al cuidado."}</h2><p>{device === "hub" ? "El Hub reúne las preguntas diarias, la información que llega de las cámaras y los permisos de la familia. La persona puede interactuar con una interfaz sencilla mientras sus familiares ven las señales importantes en Mi ONE." : "La cámara aporta observaciones de movimiento, personas y objetos a las estancias del mapa. La familia puede revisar el contexto y el estado de conexión desde Mi ONE, según sus permisos."}</p></div><div className="one-detail-depth-grid">{(device === "hub" ? [["Audio espacial", "La voz de las preguntas y las conversaciones con familiares se escuchan desde la base del Hub."],["Procesamiento de IA", "El diseño interior reserva una placa para coordinar señales y comparar el tiempo de respuesta con la referencia personal."],["Preguntas para la memoria", "El sistema presenta preguntas de rutina y muestra respuestas, tiempos y tendencias para que la familia las revise."],["Tu casa, a la vista", "Las cámaras y el mapa aparecen juntos para entender en qué estancia se observó cada evento."]] : [["Lentes y sensor", "El conjunto óptico y el sensor forman la imagen que se muestra a los cuidadores autorizados."],["IA para observaciones", "La cámara puede aportar eventos de personas, objetos y movimiento con una referencia temporal."],["Audio y comunicación", "La arquitectura de producto contempla un canal de audio para interacción y comunicación clara."],["Privacidad visible", "El panel muestra el estado de cada cámara y permite pausar la captación cuando corresponda."]]).map(([title,body],i)=><article key={title}><b>0{i+1}</b><h3>{title}</h3><p>{body}</p></article>)}</div><p className="one-detail-prototype-note">Concepto de producto: componentes y capacidades sujetos a la validación del hardware final. Las observaciones no equivalen a un diagnóstico.</p><Link to="/app" className="one-site-button dark">Conoce la app ONE <ArrowRight size={17}/></Link></section>
    {isEngineering ? <section className="one-site-engineering"><nav aria-label="Capítulos"><a href="#chapter-1">01 Forma</a><a href="#chapter-2">02 Inteligencia</a><a href="#chapter-3">03 Privacidad y energía</a><a href="#chapter-4">04 Armonía</a></nav><div>{["Forma exterior", "Inteligencia en el núcleo", "Privacidad y energía", "Todo, de nuevo en armonía"].map((chapter, index) => <article id={`chapter-${index + 1}`} key={chapter}><div><span className="one-site-kicker">0{index + 1}</span><h2>{chapter}</h2><p>{["Un diseño atemporal que se integra en cualquier espacio.", "Tecnología local que entiende lo que importa.", "Tu información, bajo tu control.", "Un sistema completo, listo para tu día a día."][index]}</p></div><img src={asset(index === 1 || index === 2 ? details.exploded : details.image)} alt="" /></article>)}</div></section>
      : <section className="one-site-detail-lower"><div><span className="one-site-kicker">DISEÑADO POR DENTRO</span><h2>{variant === 4 ? "Tecnología que cuida cada detalle" : variant === 2 ? "Diseñado para proteger lo que importa" : "Tecnología que se siente."}</h2><p>Cada detalle está pensado para un hogar más conectado, seguro y humano.</p><Link to={`/technology?v=${variant}`} className="one-site-text-link">Descubre la tecnología <ArrowRight size={17} /></Link></div><div className="one-site-detail-feature-grid">{details.features.map((feature, index) => { const Icon = [Wifi, Cpu, ShieldCheck, Heart][index]; return <div key={feature}><Icon size={28} strokeWidth={1.4} /><strong>{feature}</strong><span>{["Todo funciona en armonía.", "Procesamiento local.", "Pensado para tu hogar.", "Tú tienes el control."][index]}</span></div>; })}</div></section>}
    <div className="one-site-next-device"><span>DESCUBRE TAMBIÉN</span><ProductLink id={next} className="one-site-button light">{next === "hub" ? "ONE Hub" : "ONE Camera"} <ArrowRight size={17} /></ProductLink></div>
  </>;
}

function AdditionalProductPage({ device }: { device: "family" | "exterior" }) {
  const isFamily = device === "family";
  const title = isFamily ? "ONE Family" : "Cámara Exterior";
  const points = isFamily
    ? [["Resumen diario", "Consulta actividad, check-ins y eventos relevantes de un vistazo."], ["Cuidado compartido", "Cada familiar autorizado ve la información que corresponde a su papel."], ["Menos vigilancia constante", "Las señales ayudan a decidir cuándo contactar o acercarse a la persona."]]
    : [["Entradas y accesos", "Añade contexto a los eventos de la puerta y el exterior."], ["Estado de cámara", "Comprueba conexión, colocación y permisos desde el panel."], ["Avisos con contexto", "Revisa el evento y su cámara antes de tomar una decisión."]];
  return <>
    <section className="one-extra-product-hero"><div><span className="one-site-kicker">{isFamily ? "CUIDADO COMPARTIDO" : "CONTEXTO EN EXTERIORES"}</span><h1>{title}</h1><p>{isFamily ? "La información importante del hogar, para la familia que acompaña. Sin tener que mirar una cámara todo el día." : "Observaciones en los accesos del hogar que se integran con el resto de señales de ONE."}</p><Link className="one-site-button dark" to={isFamily ? "/dashboard/family" : "/dashboard/cameras"}>Explorar en Mi ONE <ArrowRight size={17} /></Link></div><img src={asset(isFamily ? "family" : "camera-at-home")} alt={title} /></section>
    <section className="one-extra-product-details"><span className="one-site-kicker">CÓMO AYUDA</span><h2>{isFamily ? "Todos pueden estar cerca, cada uno a su manera." : "La entrada de casa, en el mismo contexto."}</h2><div>{points.map(([heading, description], index) => <article key={heading}><b>0{index + 1}</b><h3>{heading}</h3><p>{description}</p></article>)}</div></section>
    {!isFamily && <ScrollExploded device="exterior" />}
    <div className="one-site-next-device"><span>SEGUIR EXPLORANDO</span><Link to="/products" className="one-site-button light">Todos los productos <ArrowRight size={17} /></Link></div>
  </>;
}

function TechnologyPage({ variant }: { variant: number }) {
  const [layer, setLayer] = useState(0);
  const concepts = [
    { tag: "TECNOLOGÍA", title: "Cuidado inteligente en capas", text: "Hardware, software e inteligencia que trabajan juntos para un hogar más seguro y conectado.", image: "camera-exploded" },
    { tag: "TECNOLOGÍA ONE", title: "Tu privacidad siempre en casa", text: "La cámara ve, el Hub procesa y tu app te mantiene conectado. Todo de forma segura, privada y bajo tu control.", image: "hub" },
    { tag: "HOME INTELLIGENCE", title: "Tecnología que entiende tu hogar", text: "Dispositivos que trabajan juntos, con inteligencia local, para un hogar más seguro, cómodo y privado.", image: "connected-house" },
    { tag: "TECNOLOGÍA", title: "Protección integrada desde dentro", text: "Cada capa trabaja en conjunto para proteger lo que más te importa.", image: "security-layers" },
    { tag: "TECNOLOGÍA", title: "Cómo piensa ONE", text: "Inteligencia en el hogar, construida sobre la confianza. Procesamiento local, control total y señales contextuales.", image: "hub-exploded" },
  ];
  const concept = concepts[variant - 1];
  const layers = [
    { name: "IA local", icon: BrainCircuit, text: "Inteligencia que se queda en casa." },
    { name: "Privacidad", icon: LockKeyhole, text: "Tus datos. Tu control." },
    { name: "Conectividad", icon: Wifi, text: "Siempre cerca, siempre confiable." },
    { name: "Diseño", icon: Home, text: "Tecnología que se integra en tu vida." },
  ];
  return <>
    <section className="one-site-tech-hero"><div className="one-site-tech-copy"><span className="one-site-kicker">{concept.tag}</span><h1>{concept.title}</h1><p>{concept.text}</p><Link className="one-site-button light" to={`/products?v=${variant}`}>Descubrir la tecnología <ArrowRight size={17} /></Link></div><div className="one-site-tech-visual"><img src={asset(concept.image)} alt={variant === 3 ? "Casa conectada ONE" : "Tecnología de ONE"} /></div><p className="one-site-tech-note">{variant === 5 ? "Más inteligencia. Más tranquilidad. En casa." : "Pequeños componentes. Un gran impacto."}</p></section>
    {variant === 2 && <div className="one-site-privacy-flow"><div><Camera /><strong>Cámara ONE</strong><span>Captura lo que importa</span></div><i /><LockKeyhole /><i /><div><Cpu /><strong>ONE Hub</strong><span>Procesa localmente</span></div><i /><LockKeyhole /><i /><div><Smartphone /><strong>App ONE</strong><span>Tú decides cuándo ver</span></div></div>}
    <section className="one-site-tech-layers"><div className="one-site-section-heading"><div><span className="one-site-kicker">TECNOLOGÍA PARA UNA VIDA MÁS HUMANA</span><h2>{variant === 5 ? "Seguridad en cada capa" : "Diseñado para cuidar"}</h2></div></div><div className="one-site-layer-cards">{layers.map((item, index) => { const Icon = item.icon; return <button className={index === layer ? "active" : ""} key={item.name} onClick={() => setLayer(index)}><span><Icon size={30} /></span><strong>{item.name}</strong><p>{item.text}</p><small>{index === layer ? "Seleccionado" : "Saber más"} <ArrowRight size={13} /></small></button>; })}</div><div className="one-site-layer-explain"><span className="one-site-kicker">0{layer + 1} / 04</span><h3>{layers[layer].name}</h3><p>{layers[layer].text} ONE reúne dispositivos, procesamiento y controles en un solo hogar.</p><Link to={`/support?v=${variant}`}>Ver ayuda relacionada <ArrowRight size={15} /></Link></div></section>
    <section className="one-tech-care"><div className="one-tech-care-head"><span className="one-site-kicker">CUIDADO EN ETAPAS TEMPRANAS</span><h2>Señales comprensibles para la persona y su familia.</h2><p>ONE está pensado para acompañar cuando aparecen cambios de memoria o de rutina. Reúne observaciones del hogar y respuestas del check-in para que la familia autorizada pueda revisar tendencias con calma. La herramienta no determina si una persona tiene Alzheimer ni sustituye una evaluación clínica.</p></div><div className="one-tech-care-grid"><article><Camera /><h3>Observaciones de cámaras</h3><p>Las cámaras vinculadas muestran actividad y ubicación aproximada por estancia. La familia puede revisar eventos y comprobar la conexión de cada cámara según sus permisos.</p><Link to="/dashboard/cameras">Ver cámaras <ArrowRight size={16} /></Link></article><article><MessageCircle /><h3>Preguntas y memoria</h3><p>Preguntas sencillas y actividades de recuerdo ayudan a mantener la conversación y registrar respuestas. Son actividades de acompañamiento; no prometen prevenir ni revertir el deterioro.</p><Link to="/dashboard/questions">Ver preguntas <ArrowRight size={16} /></Link></article><article><Heart /><h3>Respuestas y pulso</h3><p>El panel compara los tiempos de respuesta con el historial personal. El pulso o HR aparece solo cuando un sensor compatible entrega ese dato; la familia autorizada puede consultarlo junto con las preguntas.</p><Link to="/dashboard/questions">Ver señales <ArrowRight size={16} /></Link></article><article><Smartphone /><h3>Familia informada</h3><p>Resúmenes, tendencias y eventos permiten compartir el cuidado sin mirar la cámara continuamente. Cada persona ve únicamente la información que tiene permitida.</p><Link to="/dashboard/family">Ver familia <ArrowRight size={16} /></Link></article></div></section>
    <section className="one-tech-alerts"><div><span className="one-site-kicker">AVISOS CON CONTEXTO</span><h2>De una observación a una respuesta humana.</h2><p>ONE puede mostrar eventos a la familia para que valore si hace falta actuar. Como evolución del sistema, se podrán configurar avisos de emergencia y una escalada a servicios de emergencia o policía mediante una integración autorizada y comprobada. Esta demo no realiza llamadas ni envía avisos externos.</p></div><ol><li><b>01</b><span>La cámara o el check-in registra una señal.</span></li><li><b>02</b><span>La familia recibe contexto y decide cómo responder.</span></li><li><b>03</b><span>Una integración futura podrá activar un protocolo de emergencia configurado.</span></li></ol></section>
  </>;
}

function SupportPage({ variant }: { variant: number }) {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const matches = supportTopics.filter(topic => `${topic.title} ${topic.group} ${topic.summary}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const active = supportTopics.find(topic => topic.id === activeTopic);
  const titles = ["¿Cómo podemos ayudarte?", "Siempre a tu lado", "De la caja a tu hogar, en minutos", "Estamos contigo", "Estamos aquí para ti"];
  const subtitles = ["Encuentra respuestas, sigue guías paso a paso y saca el máximo partido a tu ONE.", "Diagnóstico inteligente, soluciones guiadas y ayuda humana cuando la necesites.", "Configura tus dispositivos ONE de forma simple y rápida.", "Respuestas, soluciones y personas reales para disfrutar de tu ONE sin preocupaciones.", "Encuentra respuestas, aprende paso a paso y saca el máximo provecho de tu sistema ONE."];
  const choose = (id: string) => { setActiveTopic(id); window.setTimeout(() => document.getElementById("support-answer")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); setSubmitted(true); if (matches.length) choose(matches[0].id); };
  return <>
    <section className="one-site-support-hero"><div className="one-site-support-copy"><span className="one-site-kicker">{variant === 3 ? "SETUP JOURNEY" : "SOPORTE ONE"}</span><h1>{titles[variant - 1]}</h1><p>{subtitles[variant - 1]}</p></div>{variant === 3 && <img className="one-site-support-phone" src={asset("setup-phone")} alt="Configuración de ONE en el móvil" />}{variant === 5 && <div className="one-site-support-device-pair"><img src={asset("hub")} alt="ONE Hub" /><img src={asset("camera")} alt="ONE Camera" /></div>}
      <form className="one-site-support-search" onSubmit={submit}><Search size={24} /><input value={query} onChange={event => { setQuery(event.target.value); setSubmitted(false); }} placeholder={variant === 5 ? "Busca guías, tutoriales, preguntas frecuentes..." : "¿Cómo podemos ayudarte?"} aria-label="Buscar ayuda" /><button type="submit">{variant === 1 ? <ArrowRight size={19} /> : "Buscar"}</button></form>
      {query && <div className="one-site-search-results" aria-live="polite"><span>{matches.length ? `${matches.length} resultado${matches.length === 1 ? "" : "s"}` : "Sin resultados"}</span>{matches.map(topic => <button key={topic.id} onClick={() => choose(topic.id)}>{topic.title}<ChevronRight size={16} /></button>)}{submitted && !matches.length && <p>Prueba con «Hub», «cámara», «privacidad» o «conexión».</p>}</div>}
    </section>
    {variant === 2 && <section className="one-site-diagnostic"><div className="one-site-diagnostic-status"><ShieldCheck size={28} /><div><h2>Estado de tus dispositivos</h2><p>Abre Mi ONE para consultar el estado real de tu Hub y tus cámaras.</p></div><Link to="/dashboard/cameras" className="one-site-button light">Ver dispositivos <ArrowRight size={16} /></Link></div><div className="one-site-diagnostic-devices"><Link to="/dashboard/map"><img src={asset("hub")} alt="" /><strong>ONE Hub</strong><span>Ver mapa</span></Link><Link to="/dashboard/cameras"><img src={asset("camera")} alt="" /><strong>Cámaras</strong><span>Ver cámaras</span></Link></div></section>}
    {variant === 3 && <div className="one-site-setup-steps">{[["1", "Conecta", "Enchufa tu dispositivo y enciéndelo."], ["2", "Configura", "Sigue la guía en Mi ONE."], ["3", "Listo", "Tu hogar más seguro e inteligente."]].map(step => <div key={step[0]}><span>{step[0]}</span><h3>{step[1]}</h3><p>{step[2]}</p></div>)}</div>}
    {variant === 4 && <div className="one-site-contact-grid">{[{ name: "Chat", icon: MessageCircle, text: "Habla con nuestro equipo." }, { name: "Llamada", icon: Smartphone, text: "Te llamamos cuando lo necesites." }, { name: "Cita remota", icon: Video, text: "Agenda una sesión con un especialista." }, { name: "Comunidad", icon: Heart, text: "Comparte y aprende." }].map(item => { const Icon = item.icon; return <button key={item.name} onClick={() => setContactOpen(true)}><Icon /><strong>{item.name}</strong><span>{item.text}</span><small>Contactar <ArrowRight size={14} /></small></button>; })}</div>}
    <section className="one-site-support-content"><div className="one-site-section-heading"><h2>{variant === 5 ? "Guías de configuración" : "Guías de soporte"}</h2><Link to="/dashboard">Ir a Mi ONE <ArrowRight size={16} /></Link></div><div className="one-site-support-topic-grid">{supportTopics.slice(0, variant === 1 ? 5 : 4).map(topic => { const Icon = topic.icon; return <button key={topic.id} onClick={() => choose(topic.id)}><span className="one-site-topic-icon"><Icon size={27} /></span><strong>{topic.group}</strong><p>{topic.summary}</p><span className="one-site-topic-arrow"><ArrowRight size={17} /></span></button>; })}</div>
      {variant === 5 && <div className="one-site-tutorials"><h2>Vídeos tutoriales</h2><div>{supportTopics.slice(0, 3).map(topic => <button key={topic.id} onClick={() => choose(topic.id)}><span className="one-site-tutorial-image"><img src={asset(topic.id === "camera" ? "camera" : topic.id === "hub" ? "hub" : "setup-phone")} alt="" /><Play size={32} fill="currentColor" /></span><strong>{topic.title}</strong><small>Ver guía paso a paso <ArrowRight size={13} /></small></button>)}</div></div>}
      {active && <article id="support-answer" className="one-site-answer"><button className="one-site-answer-close" onClick={() => setActiveTopic(null)} aria-label="Cerrar guía"><X size={20} /></button><span className="one-site-kicker">GUÍA / {active.group.toUpperCase()}</span><h2>{active.title}</h2><p>{active.summary}</p><ol>{active.steps.map(step => <li key={step}>{step}</li>)}</ol><Link to="/dashboard" className="one-site-button primary">Abrir Mi ONE <ArrowRight size={16} /></Link></article>}
    </section>
    {variant === 4 && <div className="one-site-service-band"><Check size={20} /><strong>Consulta el estado del servicio en Mi ONE.</strong><Link to="/dashboard">Abrir panel <ArrowRight size={15} /></Link></div>}
    {contactOpen && <div className="one-site-contact-backdrop" onClick={() => setContactOpen(false)}><div role="dialog" aria-modal="true" aria-label="Contactar soporte" onClick={event => event.stopPropagation()}><button onClick={() => setContactOpen(false)} aria-label="Cerrar"><X /></button><MessageCircle size={32} /><h2>Contactar con soporte</h2><p>El servicio de atención aún no está conectado. Mientras tanto, puedes consultar las guías de esta página y el estado de tus dispositivos en Mi ONE.</p><Link to="/dashboard">Ir a Mi ONE <ArrowRight size={16} /></Link></div></div>}
  </>;
}

export function MarketingSite() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [location.pathname, location.search]);
  const raw = Number(params.get("v"));
  const variant = Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : 1;
  const isDetail = ["/products/hub", "/products/camera", "/products/family", "/products/exterior"].includes(location.pathname);
  const section = location.pathname === "/" ? "home" : location.pathname === "/how-it-works" ? "how" : location.pathname === "/technology" ? "technology" : location.pathname === "/support" ? "support" : isDetail ? "detail" : "products";
  const device = location.pathname === "/products/camera" ? "camera" : "hub";
  return <main className={`one-site one-site-${section} one-site-variant-${variant}`}>
    <SiteHeader section={section} variant={variant} />
    {section === "home" ? <SiteHome /> : section === "how" ? <HowItWorksPage /> : section === "products" ? <ProductsPage key={variant} variant={variant} /> : section === "detail" ? location.pathname.endsWith("/family") || location.pathname.endsWith("/exterior") ? <AdditionalProductPage device={location.pathname.endsWith("/family") ? "family" : "exterior"} /> : <DetailPage key={`${variant}-${device}`} variant={variant} device={device} /> : section === "technology" ? <TechnologyPage key={variant} variant={variant} /> : <SupportPage key={variant} variant={variant} />}
    <div id="site-footer">{(section === "home" || section === "how" || location.pathname.endsWith("/family") || location.pathname.endsWith("/exterior")) ? <footer className="one-site-footer"><div><strong>one</strong><span>Care, made closer.</span></div><nav><Link to="/products">Productos</Link><Link to="/how-it-works">Cómo funciona</Link><Link to="/support">Soporte</Link></nav></footer> : <ConceptFooter section={section === "detail" ? `detalle de ${device === "hub" ? "Hub" : "Cámara"}` : section === "products" ? "de productos" : section === "technology" ? "de tecnología" : "de soporte"} variant={variant} detail={isDetail ? device : undefined} />}</div>
    <button className="one-site-back-top" onClick={() => { navigate(`${location.pathname}?v=${variant}`); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Volver arriba"><ArrowDown size={19} /></button>
  </main>;
}


