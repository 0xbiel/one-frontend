import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Camera, RotateCcw, ShieldCheck } from "lucide-react";

const sampleCameras = [
  { id: "living", name: "Living room camera", image: "/dashboard-assets/camera-feed-living-room.png" },
  { id: "kitchen", name: "Kitchen camera", image: "/dashboard-assets/camera-feed-kitchen.png" },
  { id: "bedroom", name: "Bedroom camera", image: "/dashboard-assets/camera-feed-bedroom.png" },
  { id: "hallway", name: "Hallway camera", image: "/dashboard-assets/camera-feed-hallway.png" },
  { id: "outside", name: "Outdoor camera", image: "/dashboard-assets/camera-feed-front-door.png" },
];

export function DemoCameraGallery() {
  const [selected, setSelected] = useState(sampleCameras[0].id);
  const [pan, setPan] = useState(0);
  const drag = useRef<{ pointer: number; startX: number; startY: number; startPan: number; captured: boolean } | null>(null);
  const camera = sampleCameras.find((item) => item.id === selected) ?? sampleCameras[0];
  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    drag.current = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, startPan: pan, captured: false };
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    const deltaX = event.clientX - drag.current.startX;
    const deltaY = event.clientY - drag.current.startY;
    if (!drag.current.captured) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) { drag.current = null; return; }
      drag.current.captured = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    const max = Math.max(70, event.currentTarget.clientWidth * .2);
    setPan(Math.max(-max, Math.min(max, drag.current.startPan + deltaX)));
  };
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  };
  return <div className="dashboard-page sample-cameras-page">
    <header className="page-heading-clean"><span className="eyebrow">CAMERAS</span><h2>Cameras</h2><p>Choose a room and explore its camera view.</p></header>
    <div className="sample-camera-summary"><div><Camera size={25} /><span><strong>Camera views</strong><small>5 rooms</small></span></div><div><i className="status-dot" /> Room views</div><div><ShieldCheck size={24} /><span><strong>Privacy is protected</strong><small>Camera and microphone stay off on this screen.</small></span></div></div>
    <section className="sample-camera-feature panel"><div className="sample-camera-title"><h3>{camera.name}</h3><button type="button" onClick={() => setPan(0)} aria-label="Reset camera view"><RotateCcw size={14} /> Reset view</button></div><div className="sample-camera-viewport" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={() => { drag.current = null; }}><img src={camera.image} alt={`View of the ${camera.name.replace(" camera", "")}`} draggable={false} style={{ transform: `translateX(${pan}px) scale(1.4)` }} /><div className="sample-camera-overlay">Drag horizontally to explore</div></div></section>
    <div className="sample-camera-grid" role="group" aria-label="Camera views">{sampleCameras.map((item) => <button key={item.id} aria-pressed={selected === item.id} className={selected === item.id ? "active" : ""} onClick={() => { setSelected(item.id); setPan(0); }}><span>{item.name}</span><small>View room</small><img src={item.image} alt="" /></button>)}</div>
  </div>;
}
