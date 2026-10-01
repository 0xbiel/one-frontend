import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MapPin, MoveUpRight, PersonStanding } from "lucide-react";

type Room = { id: string; name: string; x: number; z: number; width: number; depth: number; color: number };
type Segment = { a: [number, number]; b: [number, number] };
type MapMarker = { id: string; label: string; kind: "person" | "object"; x: number; z: number; room: string; color: number };
const rooms: Room[] = [
  { id: "living", name: "Living room", x: 0, z: 0, width: 4, depth: 4, color: 0xe4e7e0 },
  { id: "kitchen", name: "Kitchen", x: 4, z: 0, width: 3, depth: 3, color: 0xcfe8df },
  { id: "hall", name: "Hallway", x: 4, z: 3, width: 3, depth: 1, color: 0xe6dfd1 },
  { id: "bed", name: "Bedroom", x: 0, z: 4, width: 3, depth: 3, color: 0xdce5ee },
  { id: "bath", name: "Bathroom", x: 3, z: 4, width: 2, depth: 2, color: 0xd6e7eb },
];
// Every opening is a gap in a wall. The movement route passes through these gaps.
const walls: Segment[] = [
  { a: [0, 0], b: [7, 0] }, { a: [7, 0], b: [7, 4] }, { a: [7, 4], b: [5, 4] },
  { a: [5, 4], b: [5, 6] }, { a: [5, 6], b: [3, 6] }, { a: [3, 6], b: [3, 7] },
  { a: [3, 7], b: [0, 7] }, { a: [0, 7], b: [0, 0] },
  { a: [4, 0], b: [4, 1.1] }, { a: [4, 1.9], b: [4, 4] },
  { a: [4, 3], b: [5.3, 3] }, { a: [6.1, 3], b: [7, 3] },
  { a: [0, 4], b: [1.4, 4] }, { a: [2.2, 4], b: [3, 4] },
  { a: [3, 4], b: [3.5, 4] }, { a: [4.3, 4], b: [5, 4] },
  { a: [3, 4], b: [3, 6] },
];
const routes: Record<string, [number, number][]> = {
  maria: [[2.1, 2.4], [3.25, 2.1], [3.65, 1.55], [4.35, 1.55], [5.75, 1.55]],
  manuel: [[1.55, 5.65], [1.7, 4.7], [1.7, 4.4], [1.7, 3.6], [2.9, 3.55], [3.65, 2.85], [3.65, 1.55], [4.35, 1.55], [5.75, 1.55]],
};
const markers: MapMarker[] = [
  { id: "maria", label: "María García · located", kind: "person", x: 2.1, z: 2.4, room: "living", color: 0x18a5bd },
  { id: "manuel", label: "Manuel García · located", kind: "person", x: 1.55, z: 5.65, room: "bed", color: 0x0b7cfe },
  { id: "keys", label: "Keys · kitchen table", kind: "object", x: 5.75, z: 1.55, room: "kitchen", color: 0x21bdad },
  { id: "mug", label: "Mug · side table", kind: "object", x: 2.8, z: 0.8, room: "living", color: 0xe39a43 },
  { id: "glasses", label: "Reading glasses · bedside", kind: "object", x: 2.25, z: 5.55, room: "bed", color: 0x8a76dc },
  { id: "camera", label: "Camera · connected", kind: "object", x: 4.45, z: 5.25, room: "bath", color: 0x3f90d8 },
];

function DemoThreeMap({ selected, onSelect, onUnavailable }: { selected: string; onSelect: (room: string) => void; onUnavailable: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const activeRoom = rooms.find(room => room.id === selected);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    if (!("WebGLRenderingContext" in window)) { onUnavailable(); return; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x073a62);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    const targetX = activeRoom ? activeRoom.x + activeRoom.width / 2 : 3.5;
    const targetZ = activeRoom ? activeRoom.z + activeRoom.depth / 2 : 3.5;
    const detailScale = activeRoom ? Math.max(activeRoom.width, activeRoom.depth) : 1;
    camera.position.set(targetX + detailScale * 1.25, detailScale * 1.8, targetZ + detailScale * 1.4);
    camera.lookAt(targetX, 0, targetZ);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(targetX, 0, targetZ); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.15; controls.minDistance = activeRoom ? detailScale * 1.35 : 6; controls.maxDistance = activeRoom ? detailScale * 4 : 24;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d8cab, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 2.3); light.position.set(3, 12, 9); scene.add(light);
    const platformWidth = activeRoom ? activeRoom.width + .4 : 7.55;
    const platformDepth = activeRoom ? activeRoom.depth + .4 : 7.55;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(platformWidth, .16, platformDepth), new THREE.MeshStandardMaterial({ color: 0x0c6689 })); platform.position.set(targetX, -.18, targetZ); scene.add(platform);
    for (const room of (activeRoom ? [activeRoom] : rooms)) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(room.width - .025, .08, room.depth - .025), new THREE.MeshStandardMaterial({ color: room.color, roughness: 1 }));
      tile.position.set(room.x + room.width / 2, -.04, room.z + room.depth / 2); tile.userData.room = room.id; scene.add(tile);
    }
    const roomFrame = activeRoom ? (() => {
      const x0 = activeRoom.x; const x1 = activeRoom.x + activeRoom.width;
      const z0 = activeRoom.z; const z1 = activeRoom.z + activeRoom.depth;
      const middle = (x0 + x1) / 2;
      return [
        { a: [x0, z0], b: [x1, z0] }, { a: [x0, z0], b: [x0, z1] }, { a: [x1, z0], b: [x1, z1] },
        { a: [x0, z1], b: [middle - .42, z1] }, { a: [middle + .42, z1], b: [x1, z1] },
      ] as Segment[];
    })() : walls;
    for (const segment of roomFrame) {
      const [ax, az] = segment.a; const [bx, bz] = segment.b;
      const length = Math.hypot(bx - ax, bz - az);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, .7, .095), new THREE.MeshStandardMaterial({ color: 0xf7fbfd, roughness: .85 }));
      wall.position.set((ax + bx) / 2, .35, (az + bz) / 2); wall.rotation.y = -Math.atan2(bz - az, bx - ax); wall.userData.room = activeRoom?.id; scene.add(wall);
    }
    const furniture = (roomId: string, x: number, z: number, width: number, depth: number, height: number, color: number) => {
      if (activeRoom && activeRoom.id !== roomId) return;
      const item = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
      item.position.set(x, height / 2, z); item.userData.room = roomId; scene.add(item);
    };
    furniture("living", .45, 1.5, .38, 1.55, .28, 0xb4c2c8);
    furniture("living", 1.25, 1.5, .9, .65, .2, 0xc6b6a4);
    furniture("living", 2.8, .8, .45, .42, .38, 0xb2c0b7);
    furniture("kitchen", 6.15, 1.05, .86, .68, .33, 0xbcae9b);
    furniture("kitchen", 5.7, .3, 1.45, .32, .35, 0xd0d7d4);
    furniture("bed", 1.2, 5.4, 1.25, 1.65, .23, 0xb9c6d0);
    furniture("bed", 1.2, 4.7, 1.1, .42, .28, 0xf9faf7);
    furniture("bath", 4.4, 5.3, .65, .48, .4, 0xf3f6f7);
    furniture("hall", 4.45, 3.52, .32, .32, .45, 0x769c75);
    const visibleMarkers = activeRoom ? markers.filter(item => item.room === activeRoom.id) : markers;
    if (!activeRoom) {
      for (const personId of ["maria", "manuel"]) {
        const points = routes[personId].map(([x, z]) => new THREE.Vector3(x, .13, z));
        const color = markers.find(item => item.id === personId)?.color ?? 0x1680ee;
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color, dashSize: .12, gapSize: .1 }));
        line.computeLineDistances();
        scene.add(line);
      }
    }
    for (const currentMarker of visibleMarkers) {
      if (currentMarker.kind === "person") {
        const person = new THREE.Group();
        const clothing = new THREE.MeshStandardMaterial({ color: currentMarker.color, roughness: .65 });
        const skin = new THREE.MeshStandardMaterial({ color: 0xf2c7a7, roughness: .75 });
        const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotationZ = 0) => {
          const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.rotation.z = rotationZ; mesh.userData.room = currentMarker.room; person.add(mesh);
        };
        part(new THREE.SphereGeometry(.09, 16, 12), skin, 0, .45, 0);
        part(new THREE.CapsuleGeometry(.08, .22, 4, 8), clothing, 0, .24, 0);
        part(new THREE.CylinderGeometry(.035, .045, .2, 8), clothing, -.09, .24, 0, -.25);
        part(new THREE.CylinderGeometry(.035, .045, .2, 8), clothing, .09, .24, 0, .25);
        part(new THREE.CylinderGeometry(.04, .035, .23, 8), clothing, -.05, .04, 0, -.12);
        part(new THREE.CylinderGeometry(.04, .035, .23, 8), clothing, .05, .04, 0, .12);
        person.position.set(currentMarker.x, .08, currentMarker.z); scene.add(person);
      } else {
        const object = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, .08, 16), new THREE.MeshStandardMaterial({ color: currentMarker.color, roughness: .45 }));
        object.position.set(currentMarker.x, .22, currentMarker.z); object.userData.room = currentMarker.room; scene.add(object);
      }
    }
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const onPointer = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children).find((item) => typeof item.object.userData.room === "string");
      if (hit) onSelect(hit.object.userData.room as string);
    };
    renderer.domElement.addEventListener("click", onPointer);
    const resize = () => { const width = host.clientWidth || 640; const height = host.clientHeight || 400; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(host);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    const render = () => renderer.render(scene, camera);
    if (reducedMotion) { controls.enableDamping = false; controls.addEventListener("change", render); render(); }
    else { const animate = () => { controls.update(); render(); frame = requestAnimationFrame(animate); }; animate(); }
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener("change", render); renderer.domElement.removeEventListener("click", onPointer); controls.dispose(); scene.traverse((item) => { if (item instanceof THREE.Mesh || item instanceof THREE.Line) { item.geometry.dispose(); const material = item.material; if (Array.isArray(material)) material.forEach((part) => part.dispose()); else material.dispose(); } }); renderer.dispose(); host.replaceChildren(); };
  }, [activeRoom, onSelect, onUnavailable]);
  return <div className="sample-map-3d" ref={mount} role="img" aria-label={activeRoom ? `Detailed 3D view of the ${activeRoom.name}. Drag to rotate.` : "Interactive 3D whole-house map. Drag to rotate and click a room to select it."} />;
}

function DemoFloorPlan2D({ selected, onSelect, onMarker }: { selected: string; onSelect: (room: string) => void; onMarker: (id: string, room: string) => void }) {
  return <svg className="sample-map-2d" viewBox="0 0 800 800" role="group" aria-label="Interactive 2D floor plan">
    <g transform="translate(50 50) scale(100)">
      {rooms.map((room) => <g key={room.id} role="button" tabIndex={0} aria-label={`Select ${room.name}`} onClick={() => onSelect(room.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(room.id); } }}>
        <rect x={room.x} y={room.z} width={room.width} height={room.depth} fill={`#${room.color.toString(16).padStart(6, "0")}`} className={selected === room.id ? "selected" : ""} aria-pressed={selected === room.id} />
      </g>)}
      {walls.map((wall, index) => <line key={index} x1={wall.a[0]} y1={wall.a[1]} x2={wall.b[0]} y2={wall.b[1]} className="sample-map-wall" />)}
      {Object.entries(routes).map(([id, points]) => <polyline key={id} points={points.map(([x, z]) => `${x},${z}`).join(" ")} className={`sample-map-route ${id === "maria" ? "maria-route" : "manuel-route"}`} />)}
      {markers.map((item) => <g key={item.id} className={`sample-map-marker-group ${item.kind}`} transform={`translate(${item.x} ${item.z})`} role="button" tabIndex={0} aria-label={`${item.label} in ${rooms.find(room => room.id === item.room)?.name}`} onClick={() => onMarker(item.id, item.room)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onMarker(item.id, item.room); } }}>
        <title>{item.label} · {rooms.find(room => room.id === item.room)?.name}</title>
        {item.kind === "person" ? <g className="sample-map-person" style={{ fill: `#${item.color.toString(16).padStart(6, "0")}` }}><circle cx="0" cy="-.23" r=".085" /><path d="M 0 -.13 L 0 .12 M 0 -.04 L -.13 .05 M 0 -.04 L .13 .05 M 0 .12 L -.1 .27 M 0 .12 L .1 .27" /></g> : <g className="sample-map-object" style={{ color: `#${item.color.toString(16).padStart(6, "0")}` }}><circle r=".14" /><path d="M -.07 -.07 L .08 .08 M .08 -.07 L -.07 .08" /></g>}
      </g>)}
    </g>
    {rooms.map((room) => {
      const centerX = 50 + (room.x + room.width / 2) * 100;
      const centerY = 50 + (room.z + room.depth / 2) * 100;
      const width = Math.min(room.width * 100 - 14, room.name.length * 10 + 30);
      return <g key={`${room.id}-label`} className="sample-map-label" pointerEvents="none"><rect x={centerX - width / 2} y={centerY - 15} width={width} height="30" rx="8" /><text x={centerX} y={centerY + 5} textAnchor="middle">{room.name}</text></g>;
    })}
  </svg>;
}

export function DemoHomeMap() {
  const [view, setView] = useState<"2d" | "3d">("3d");
  const fallbackTo2D = useCallback(() => setView("2d"), []);
  const [selected, setSelected] = useState("all");
  const [marker, setMarker] = useState<string | null>(null);
  const selectRoom = useCallback((value: string) => { setSelected(value); setMarker(null); }, []);
  const selectMarker = useCallback((id: string, roomId: string) => { setMarker(id); setSelected(roomId); }, []);
  const room = rooms.find((item) => item.id === selected);
  const selectedMarker = markers.find((item) => item.id === marker);
  const roomMarkers = room ? markers.filter(item => item.room === room.id) : markers;
  return <div className="dashboard-page sample-map-page">
    <header className="page-heading-clean"><span className="eyebrow">ONE HOME</span><h2>Home map</h2><p>See people, familiar objects, and movement routes around the home. Choose a room for a closer 3D view.</p></header>
    <div className="sample-map-layout"><section className="sample-map-stage panel"><div className="sample-map-toolbar"><div><span className="eyebrow">HOME MAP</span><h3>{room ? room.name : "Whole house"}</h3></div><div className="view-toggle" role="group" aria-label="Map view"><button className={view === "3d" ? "active" : ""} onClick={() => setView("3d")}>3D</button><button className={view === "2d" ? "active" : ""} onClick={() => setView("2d")}>2D</button></div></div>
      {view === "3d" ? <DemoThreeMap selected={selected} onSelect={selectRoom} onUnavailable={fallbackTo2D} /> : <DemoFloorPlan2D selected={selected} onSelect={selectRoom} onMarker={selectMarker} />}
      <div className="sample-map-legend"><span><PersonStanding size={16} /> María · route</span><span><PersonStanding size={16} /> Manuel · route</span><span><MapPin size={16} /> People and objects</span></div></section>
      <aside className="sample-map-aside"><div className="panel"><span className="eyebrow">MAP AREA</span><h3>{room?.name ?? "Whole house"}</h3><p>{room ? `${roomMarkers.map(item => item.label.split(" · ")[0]).join(", ")} located here.` : "All people and objects are shown at their fixed last-seen locations."}</p><div className="sample-room-list"><button className={!room ? "active" : ""} aria-pressed={!room} onClick={() => { setSelected("all"); setMarker(null); }}>Whole house</button>{rooms.map((item) => <button key={item.id} className={selected === item.id ? "active" : ""} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setMarker(null); }}>{item.name}</button>)}</div></div><div className="panel"><span className="eyebrow">PEOPLE AND OBJECTS</span><h3>{selectedMarker ? `${selectedMarker.label.split(" · ")[0]} located` : "Last seen locations"}</h3><p>{selectedMarker ? `Approximate location · ${rooms.find(item => item.id === selectedMarker.room)?.name}` : "Select an item to see its room. Object positions stay fixed when people move."}</p><div className="sample-room-list">{roomMarkers.map(item => <button key={item.id} className={marker === item.id ? "active" : ""} aria-pressed={marker === item.id} onClick={() => { setMarker(item.id); setSelected(item.room); }}>{item.label}<MoveUpRight size={14} /></button>)}</div></div></aside>
    </div>
    <StreetRouteDemo />
  </div>;
}

const streetStops = [
  { id: "park", label: "Maple Park", x: 290, y: 80, path: "M100 320V200H290V80", street: "Maple Street" },
  { id: "pharmacy", label: "Oak Pharmacy", x: 480, y: 80, path: "M100 320V200H480V80", street: "Oak Avenue" },
  { id: "market", label: "Market Square", x: 670, y: 200, path: "M100 320V200H670", street: "Market Road" },
  { id: "cafe", label: "Garden Café", x: 480, y: 320, path: "M100 320H480", street: "Garden Lane" },
];

function StreetRouteDemo() {
  const [destination, setDestination] = useState(streetStops[1].id);
  const stop = streetStops.find(item => item.id === destination) ?? streetStops[0];
  return <section className="sample-street-card panel">
    <div className="sample-street-heading"><div><span className="eyebrow">OUTSIDE</span><h3>Neighbourhood routes</h3><p>Choose a familiar place to preview a route from home.</p></div><strong>Home → {stop.label}</strong></div>
    <svg className="sample-street-map" viewBox="0 0 760 410" role="img" aria-label={`Street route from home to ${stop.label} along ${stop.street}`}>
      <rect width="760" height="410" rx="16" fill="#eff5f1" />
      <g stroke="#fff" strokeWidth="38" fill="none"><path d="M0 80H760M0 200H760M0 320H760M100 0V410M290 0V410M480 0V410M670 0V410" /></g>
      <g stroke="#d4dfda" strokeWidth="2" fill="none"><path d="M0 80H760M0 200H760M0 320H760M100 0V410M290 0V410M480 0V410M670 0V410" /></g>
      <g fill="#dce8df" stroke="#c6d8ce" strokeWidth="2"><rect x="120" y="100" width="145" height="78" rx="8" /><rect x="310" y="100" width="145" height="78" rx="8" /><rect x="500" y="100" width="145" height="78" rx="8" /><rect x="120" y="220" width="145" height="78" rx="8" /><rect x="310" y="220" width="145" height="78" rx="8" /><rect x="500" y="220" width="145" height="78" rx="8" /></g>
      <path d={stop.path} fill="none" stroke="#147df1" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 12" className="sample-street-route" />
      <circle cx="100" cy="320" r="14" fill="#fff" stroke="#147df1" strokeWidth="6" /><circle cx={stop.x} cy={stop.y} r="13" fill="#2fc29b" stroke="#fff" strokeWidth="5" />
      <text x="100" y="355" textAnchor="middle">HOME</text><text x={stop.x} y={stop.y - 22} textAnchor="middle">{stop.label.toUpperCase()}</text>
    </svg>
    <div className="sample-street-stops" aria-label="Neighbourhood destinations">{streetStops.map(item => <button type="button" key={item.id} className={destination === item.id ? "active" : ""} aria-pressed={destination === item.id} onClick={() => setDestination(item.id)}>{item.label}<small>{item.street}</small></button>)}</div>
  </section>;
}
