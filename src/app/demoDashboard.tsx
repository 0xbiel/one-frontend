import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, Box, CalendarDays, Camera, ChevronRight, Heart, Home, Map, MessageSquareText, Pause, Play, Plus, Settings, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import "./demoDashboard.css";
import { LocalCameraGallery } from "./LocalCameraGallery";
import "./legalLinks.css";

const A = "/dashboard-assets/";
const nav = [
  ["/dashboard", "Overview", Home], ["/dashboard/live", "Today’s check-in", Heart],
  ["/dashboard/map", "Home map", Map], ["/dashboard/cameras", "Camera", Camera],
  ["/dashboard/questions", "Questions & signals", MessageSquareText], ["/dashboard/events", "Events", CalendarDays],
] as const;
const observations = [
  { title: "Object observed", detail: "Object detected in the living room, compared with personal baseline.", camera: "Living room camera", room: "Living room", time: "10:13 AM", type: "object" },
  { title: "Person detected", detail: "Person detected in the kitchen, compared with personal baseline.", camera: "Kitchen camera", room: "Kitchen", time: "9:42 AM", type: "person" },
  { title: "Movement observed", detail: "Increased movement in the hallway, compared with personal baseline.", camera: "Hallway camera", room: "Hallway", time: "8:17 AM", type: "movement" },
  { title: "Door activity", detail: "Front door opened, compared with personal baseline.", camera: "Front door camera", room: "Front door", time: "7:56 AM", type: "door" },
  { title: "Object observed", detail: "Object detected in the bedroom, compared with personal baseline.", camera: "Bedroom camera", room: "Bedroom", time: "6:21 AM", type: "object" },
];

function Brand() { return <span className="dd-brand"><img src="/one-logo.png" alt="" />one</span>; }

function WaveHero({ checkin = false, completed = false, onCamera }: { checkin?: boolean; completed?: boolean; onCamera: () => void }) {
  return <section className="dd-wave-hero"><div className="dd-wave-back" /><div className="dd-wave-moon"/><div className="dd-wave-line"/><div className="dd-wave-house">⌂</div><div className="dd-wave-copy"><small>{checkin ? "DAILY CHECK-IN" : "▣ ROOM CAMERA"}</small><h2>{checkin ? completed ? "Today’s check-in is recorded" : "No check-in has been recorded yet" : "Room camera"}</h2><span>{checkin ? completed ? "Questions are ready for family review." : "When the resident completes a check-in, ONE will place the result here." : "●  ONLINE"}</span></div><div className="dd-wave-aside"><p>A calmer, safer<br/>today with a<br/>little more<br/>peace of mind.</p><button onClick={onCamera}>Camera setup <ChevronRight size={17}/></button></div></section>;
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <header className="dd-section-head"><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></header>;
}

function Overview({ go }: { go: (path: string) => void }) {
  const checkins=useQuery({queryKey:["check-in-questions"],queryFn:()=>api.getCheckInQuestions(),retry:false});
  const completed=Boolean(checkins.data?.some(item=>new Date(item.askedAt).toDateString()===new Date().toDateString()));
  return <><SectionHead eyebrow="ONE HOME" title="Your Home, in view" subtitle="A calm overview of today’s care, activity and home signals."/><WaveHero onCamera={() => go("/dashboard/cameras")}/><h3 className="dd-subhead">Recent observations</h3><div className="dd-observation-cards">{observations.slice(0,2).map((o,i)=><button key={i} onClick={()=>go("/dashboard/events")}><span className="dd-round">{i ? <Users size={18}/> : <Box size={18}/>}</span><span><strong>{o.title}</strong><small>Approximate household observation; not a diagnosis.</small><time>{o.time}</time></span></button>)}</div><button className="dd-checkin-strip" onClick={()=>go("/dashboard/live")}><span className="dd-round gray"/><span><small>TODAY’S CHECK-IN</small><strong>{completed?"Today’s check-in is recorded.":"Waiting for today’s check-in."}</strong><em>{completed?"Questions are available for review.":"No check-in has been recorded yet."}</em></span><span className="dd-checkin-progress">{completed?"Recorded today":"Not recorded yet"}<i/></span><b>Open check-in</b></button><h3 className="dd-subhead">Home at a glance</h3><div className="dd-glance">{[["1 camera online","Room cameras are online","/dashboard/cameras",Camera],["3 recent observations","Household activity observed today, not a diagnosis","/dashboard/events",Activity],[completed?"Check-in recorded":"No check-in yet",completed?"Today’s questions are available":"Today’s check-in is not recorded","/dashboard/live",Heart]].map(([title,detail,path,Icon])=><button key={String(path)} onClick={()=>go(String(path))}><span className="dd-round"><Icon size={18}/></span><span><strong>{String(title)}</strong><small>{String(detail)}</small></span><ChevronRight size={18}/></button>)}</div></>;
}

function Checkin({ go }: { go: (path: string) => void }) {
  const checkins=useQuery({queryKey:["check-in-questions"],queryFn:()=>api.getCheckInQuestions(),retry:false});
  const completed=Boolean(checkins.data?.some(item=>new Date(item.askedAt).toDateString()===new Date().toDateString()));
  return <><SectionHead eyebrow="ONE HOME" title="Today’s check-in" subtitle="A calm human signal, compared with the resident’s own recent rhythm."/><WaveHero checkin completed={completed} onCamera={()=>go("/dashboard/cameras")}/><div className="dd-two-cols dd-checkin-cols"><section className="dd-card"><small>HOW IT READS</small><h2>One signal, with context</h2>{[["Familiar prompt","A short daily check-in keeps the interaction predictable."],["Human response","The response is recorded as a signal, without turning it into a diagnosis."],["Personal baseline","Caregivers review changes against the resident’s own recent pattern."]].map(([title,text],i)=><div className="dd-step" key={title}><b>{i+1}</b><span><strong>{title}</strong><small>{text}</small></span></div>)}</section><section className="dd-card"><small>TODAY’S CONTEXT</small><h2>Recent household signals</h2><p>These observations stay separate from the check-in. They help a caregiver review the day in context.</p>{observations.slice(0,3).map((o,i)=><button className="dd-mini-event" key={i} onClick={()=>go("/dashboard/events")}><span className="dd-round gray"/><span><strong>{o.title}</strong><small>Approximate household observation; not diagnosis.</small></span><time>{o.time}</time><ChevronRight size={16}/></button>)}<button className="dd-link" onClick={()=>go("/dashboard/events")}>View all household signals <ChevronRight size={16}/></button></section></div><section className="dd-card dd-weekly"><div><small>WEEKLY CHECK-IN RHYTHM</small><h2>A calmer picture, over time</h2><p>Each day’s check-in is compared with the resident’s own recent rhythm, so small changes can be seen in context.</p></div><div className="dd-week-dots">{["Mon","Tue","Wed","Thu","Fri","Today"].map((d,i)=><span key={d}><i className={i===5?"current":""}/>{d}</span>)}</div><aside>{completed?"Check-in recorded today":"No check-ins this week yet"}<br/><small>{completed?"The answers are available in Questions & Signals.":"Check-ins will appear here as they’re recorded."}</small></aside></section></>;
}

function MapPage({ go }: { go: (path: string) => void }) {
  const [view, setView] = useState<"3D"|"2D">("3D");
  return <><SectionHead eyebrow="ONE HOME" title="Home map" subtitle="Review room geometry, camera context, and approximate last-seen locations in one place."/><div className="dd-map-layout"><div><section className={`dd-map-visual ${view==="2D"?"is-2d":""}`}><div className="dd-map-top"><span>LIDAR ROOMPLAN MODEL · DEMONSTRATION</span><div><button className={view==="3D"?"active":""} onClick={()=>setView("3D")}>3D</button><button className={view==="2D"?"active":""} onClick={()=>setView("2D")}>2D</button></div></div><h2>MAP VIEW <small>● LIVE NOW</small></h2><img className={view==="2D"?"flat":""} src={A+(view==="2D"?"home-floorplan-2d.svg":"home-floorplan-isometric.svg")} alt="Illustrated floor plan of the connected home"/><div className="dd-map-person"><img src={A+"home-map-3d-person.png"} alt=""/>Person now</div><div className="dd-map-legend">● Recent movement &nbsp;&nbsp; ◉ Observed location</div></section><section className="dd-card dd-live-movement"><h2>Live movement <small>● DEMO</small></h2><div><span>🚶 <b>Walking</b><small>Moving around home.</small></span><span>↗ <b>Towards kitchen</b><small>Approximate location.</small></span></div><p>Location trace · last 10 minutes <span>•• ••• • •••• •••</span></p></section></div><aside className="dd-map-side"><section className="dd-card"><small>SELECTED MEMORY</small><h3>Person</h3><p>Last seen now</p><hr/><small>Confidence</small><div className="dd-confidence"><i/></div><small>Current room</small><h4>⌂ Living room</h4><button className="dd-blue-button" onClick={()=>go("/dashboard/cameras")}>▣ View live movement <ChevronRight size={15}/></button></section><section className="dd-card"><small>FIXED CAMERA · ONLINE</small><h4>Camera connection</h4><p>Room camera online</p><div className="dd-map-camera-placeholder"/></section><section className="dd-card"><small>LOCALIZATION TRACE</small><h4>Where the camera thinks it is</h4><p>Each localization allows a non-diagnostic review of approximate movement.</p></section></aside></div></>;
}

function Cameras() {
  return <><SectionHead eyebrow="CAMERAS" title="Cameras" subtitle="Connect your computer’s cameras and view them live."/><LocalCameraGallery/></>;
}

function Questions() {
  const [range,setRange]=useState<"Today"|"7 Days"|"30 days">("7 Days");
  const query=useQuery({queryKey:["check-in-questions"],queryFn:()=>api.getCheckInQuestions(),retry:false});
  const now=Date.now();
  const rows=(query.data??[]).filter(item=>range==="Today"?new Date(item.askedAt).toDateString()===new Date().toDateString():new Date(item.askedAt).getTime()>=now-(range==="7 Days"?7:30)*86_400_000).map(item=>[item.question,item.pulseBpm===null?"—":`${item.pulseBpm} BPM`,item.responseTimeMs===null?"—":`${Math.round(item.responseTimeMs/1000)} seconds`,item.answer||"No answer",new Date(item.askedAt).toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"})]);
  const chartItems=(query.data??[]).filter(item=>item.responseTimeMs!==null).sort((a,b)=>new Date(a.askedAt).getTime()-new Date(b.askedAt).getTime()).slice(-7);
  const baselines=chartItems.flatMap(item=>item.baselineMs===null?[]:[item.baselineMs]);
  const baseline=baselines.length?Math.round(baselines.reduce((sum,value)=>sum+value,0)/baselines.length):null;
  const chartPoints=chartItems.map((item,index)=>[chartItems.length===1?350:index*700/(chartItems.length-1),150-Math.min(item.responseTimeMs??0,30000)/30000*135]);
  return <><div className="dd-questions-top"><SectionHead eyebrow="QUESTIONS & SIGNALS" title="Questions & Signals" subtitle="Review the questions asked during check-ins and the signals around each answer."/><div className="dd-segmented">{(["Today","7 Days","30 days"] as const).map(r=><button key={r} className={range===r?"active":""} onClick={()=>setRange(r)}>{r}</button>)}</div></div><div className="dd-questions-layout"><section className="dd-chart"><small>RESPONSE TIME · {range.toUpperCase()}</small><h2>Response time vs personal baseline</h2><div className="dd-chart-plot"><span className="dd-chart-y">30s<br/>20s<br/>10s<br/>0s</span><svg viewBox="0 0 700 160" preserveAspectRatio="none" aria-label="Demo response time graph">{baseline!==null&&<line x1="0" x2="700" y1={150-Math.min(baseline,30000)/30000*135} y2={150-Math.min(baseline,30000)/30000*135} stroke="#ade7fb" strokeDasharray="6 6"/>}{chartPoints.length>1&&<polyline points={chartPoints.map(([x,y])=>`${x},${y}`).join(" ")} fill="none" stroke="#68dfff" strokeWidth="4"/>}{chartPoints.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5" fill="#6adfff" stroke="white" strokeWidth="2"/>)}</svg></div><div className="dd-chart-days">{chartItems.map(item=><span key={item.id}>{new Date(item.askedAt).toLocaleDateString("en",{month:"short",day:"numeric"})}</span>)}</div><p>● Average response time &nbsp;&nbsp;&nbsp; ┄ Personal baseline {baseline===null?"unavailable":`${Math.round(baseline/1000)} sec`} <small>Example data · not a diagnosis</small></p></section><aside className="dd-card dd-baseline"><small>ABOUT PERSONAL BASELINE</small><h2>More context, fewer assumptions</h2><p>Response times can vary. The family sees changes alongside answers and pulse when those signals are available from connected devices.</p><p>✓ Adapts to individual patterns<br/>✓ Helps identify meaningful changes<br/>✓ Keeps responses in context</p></aside></div><section className="dd-card dd-question-table"><h2>Questions asked {range==="Today"?"today":`in the last ${range.toLowerCase()}`}</h2><p>Questions received from the assistant or Hub, with available signals.</p><div className="dd-table-scroll"><table><thead><tr><th>#</th><th>Questions</th><th>Answer</th><th>Pulse</th><th>Response time</th><th>Time</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{i+1}</td><td>{row[0]}</td><td>{row[3]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[4]}</td></tr>)}</tbody></table></div></section></>;
}

function Events() {
  const [filter,setFilter]=useState("All events"); const [expanded,setExpanded]=useState<string|null>(null);
  const filters=["All events","People","Objects","Activity","Cameras"];
  const visible=observations.filter(o=>filter==="All events"||filter==="Cameras"||filter==="People"&&o.type==="person"||filter==="Objects"&&o.type==="object"||filter==="Activity"&&["movement","door"].includes(o.type));
  return <><SectionHead eyebrow="EVENTS" title="Events" subtitle="Household observations available for review"/><div className="dd-filters">{filters.map(f=><button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f}</button>)}</div>{["Today","Yesterday"].map((day,d)=><section className="dd-events-day" key={day}><header><h2>{day}</h2><span>September {d?11:12}, 2026</span><small>{visible.length} observations</small></header><div className="dd-event-list">{visible.map((o,i)=><button key={i} className="dd-event-item" onClick={()=>setExpanded(expanded===`${d}-${i}`?null:`${d}-${i}`)}><span className={`dd-event-type ${o.type}`}>{o.type==="object"?<Box/>:o.type==="person"?<Users/>:o.type==="movement"?<Activity/>:<Home/>}</span><span><strong>{o.title}</strong><small>{o.detail}</small>{expanded===`${d}-${i}`&&<em>Observation for review. This does not provide a medical diagnosis.</em>}</span><span className="dd-event-camera"><Camera size={18}/><span><strong>{o.camera}</strong><small>{o.room}</small></span></span><time>{o.time}</time><ChevronRight size={18}/></button>)}</div></section>)}</>;
}

type DemoPerson = { name: string; role: string };
const initialPeople: DemoPerson[] = [
  { name: "Biel Oliver Mas", role: "Care recipient" },
  { name: "Clara García", role: "Family caregiver" },
  { name: "María García", role: "Family caregiver" },
];

function FamilyUsers({ people, onAdd, onSelect }: { people: DemoPerson[]; onAdd: (person: DemoPerson) => void; onSelect: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Family caregiver");
  return <><SectionHead eyebrow="HOUSEHOLD" title="Family & care team" subtitle="People connected to this care space and their roles."/><div className="dd-family-header dd-card"><div><Users size={30}/><span><strong>{people.length} people in ONE Home</strong><small>Example people for this presentation</small></span></div><button className="dd-blue-button" onClick={()=>setAdding(true)}><Plus size={17}/> Add person</button></div><div className="dd-family-grid">{people.map((person,index)=><article className="dd-card" key={`${person.name}-${index}`}><span className="dd-family-avatar">{person.name.split(" ").map(part=>part[0]).slice(0,2).join("")}</span><div><h2>{person.name}</h2><p>{person.role}</p><small>{person.role==="Care recipient"?"Personal baseline · connected home":"Care team · demo access"}</small></div>{person.role==="Care recipient"&&<button onClick={()=>onSelect(person.name)}>View person <ChevronRight size={15}/></button>}</article>)}</div>{adding&&<div className="dd-modal-backdrop" onClick={()=>setAdding(false)}><form className="dd-family-form" onClick={event=>event.stopPropagation()} onSubmit={event=>{event.preventDefault();if(!name.trim())return;onAdd({name:name.trim(),role});setName("");setAdding(false)}}><button type="button" onClick={()=>setAdding(false)} aria-label="Close"><X/></button><h2>Add a person</h2><p>Add a sample person to this presentation. No invitation is sent.</p><label>Name<input value={name} onChange={event=>setName(event.target.value)} required placeholder="Full name"/></label><label>Role<select value={role} onChange={event=>setRole(event.target.value)}><option>Family caregiver</option><option>Care recipient</option><option>Care team</option></select></label><button className="dd-blue-button" type="submit">Add to demo</button></form></div>}</>;
}

export function DemoDashboard() {
  const location=useLocation(); const navigate=useNavigate(); const [paused,setPaused]=useState(false); const [mobileMenu,setMobileMenu]=useState(false); const [people,setPeople]=useState<DemoPerson[]>(initialPeople); const [recipient,setRecipient]=useState("Biel Oliver Mas"); const [recipientOpen,setRecipientOpen]=useState(false);
  const go=(path:string)=>{navigate(path);setMobileMenu(false);window.scrollTo(0,0)};
  const path=location.pathname;
  return <main className="dd-shell">
    <button className="dd-mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}>☰ Menu</button>
    <aside className={`dd-sidebar ${mobileMenu ? "open" : ""}`}>
      <Link to="/" className="dd-home-logo"><Brand /></Link>
      <label>Caring for</label><button className="dd-home-select"><span className="dd-round" /><span><strong>ONE Home</strong><small>● Connected home</small></span></button>
      <label>Care recipient</label><button className="dd-recipient" onClick={() => setRecipientOpen(!recipientOpen)} aria-expanded={recipientOpen}>{recipient} · baseline</button>
      {recipientOpen && <div className="dd-recipient-list">{people.filter(person => person.role === "Care recipient").map(person => <button key={person.name} onClick={() => { setRecipient(person.name); setRecipientOpen(false); }}>{person.name}</button>)}</div>}
      <nav>{nav.map(([to, label, Icon]) => <button key={to} className={path === to ? "active" : ""} onClick={() => go(to)}><Icon size={17} />{label}</button>)}<small>HOUSEHOLD</small><button onClick={() => go("/dashboard/assistant")}><Sparkles size={17} />Assistant</button><button className={path === "/dashboard/family" ? "active" : ""} onClick={() => go("/dashboard/family")}><Users size={17} />Family & care team</button><small>SETTINGS</small><a className="dd-legal-nav-link" href="/legal/privacy-notice.html#privacy" aria-label="Open the Privacy Notice in English or Spanish"><ShieldCheck size={17} />Privacy notice</a><button onClick={() => go("/dashboard/account")}><Settings size={17} />Account settings</button></nav>
    </aside>
    <div className="dd-main"><div className="dd-top-actions"><span className="dd-demo-label">DEMO · sample data</span><button onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "RESUME CARE" : "PAUSE CARE"}</button><span className="dd-avatar" /></div>
      {paused && <div className="dd-paused">Care is paused in this demo.</div>}
      {path === "/dashboard/map" ? <MapPage go={go} /> : path === "/dashboard/live" ? <Checkin go={go} /> : path === "/dashboard/cameras" ? (paused ? <section className="dd-card" role="status">Camera capture is paused. Select “RESUME CARE” to reconnect.</section> : <Cameras />) : path === "/dashboard/questions" ? <Questions /> : path === "/dashboard/events" ? <Events /> : path === "/dashboard/family" ? <FamilyUsers people={people} onAdd={person => setPeople(current => [...current, person])} onSelect={name => { setRecipient(name); go("/dashboard"); }} /> : <Overview go={go} />}
    </div>
  </main>;
}



