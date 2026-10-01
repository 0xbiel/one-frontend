import { useState } from "react";
import { Camera, LockKeyhole, ShieldCheck } from "lucide-react";

const sampleCameras = [
  { id: "living", name: "Living room camera", image: "/dashboard-assets/camera-feed-living-room.png" },
  { id: "kitchen", name: "Kitchen camera", image: "/dashboard-assets/camera-feed-kitchen.png" },
  { id: "bedroom", name: "Bedroom camera", image: "/dashboard-assets/camera-feed-bedroom.png" },
  { id: "hallway", name: "Hallway camera", image: "/dashboard-assets/camera-feed-hallway.png" },
  { id: "outside", name: "Outdoor camera", image: "/dashboard-assets/camera-feed-front-door.png" },
];

export function DemoCameraGallery() {
  const [selected, setSelected] = useState(sampleCameras[0].id);
  const camera = sampleCameras.find((item) => item.id === selected) ?? sampleCameras[0];
  return <div className="dashboard-page sample-cameras-page">
    <header className="page-heading-clean"><span className="eyebrow">CAMERAS · SAMPLE DATA</span><h2>Cameras</h2><p>Explore a sample household. These are static images, not live feeds.</p></header>
    <div className="sample-camera-summary"><div><Camera size={25} /><span><strong>Connected cameras</strong><small>5 sample camera views</small></span></div><div><i className="status-dot" /> 5 sample views</div><div><ShieldCheck size={24} /><span><strong>Privacy is protected</strong><small>The demo never opens your camera or microphone.</small></span></div></div>
    <section className="sample-camera-feature panel"><div className="sample-camera-title"><h3>{camera.name}</h3><span>Sample image</span></div><img src={camera.image} alt={`Sample view of the ${camera.name.replace(" camera", "")}`} /><div className="sample-camera-overlay"><LockKeyhole size={14} /> Illustrative preview · no live capture</div></section>
    <div className="sample-camera-grid" role="group" aria-label="Sample cameras">{sampleCameras.map((item) => <button key={item.id} aria-pressed={selected === item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><span>{item.name}</span><small>Sample</small><img src={item.image} alt="" /></button>)}</div>
  </div>;
}
