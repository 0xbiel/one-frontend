import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MapPin, MoveUpRight, PersonStanding } from "lucide-react";

type Room = { id: string; name: string; x: number; z: number; width: number; depth: number; color: number };
type Segment = { a: [number, number]; b: [number, number] };
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
const route: [number, number][] = [[1.4, 2.1], [2.7, 2.1], [3.6, 1.5], [4.4, 1.5], [5.4, 1.5], [5.7, 2.5], [5.7, 3.5], [4.1, 3.5], [4.1, 3.9], [4.1, 4.1], [3.9, 4.3]];
const markers = [
  { id: "person", label: "Person · last seen now", x: 1.4, z: 2.1, room: "living" },
  { id: "keys", label: "Keys · approximate location", x: 5.4, z: 1.5, room: "kitchen" },
  { id: "camera", label: "Camera · connected", x: 3.9, z: 4.3, room: "bath" },
];

function DemoThreeMap({ selected, selectedMarker, onSelect, onUnavailable }: { selected: string; selectedMarker: string | null; onSelect: (room: string) => void; onUnavailable: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    if (!("WebGLRenderingContext" in window)) { onUnavailable(); return; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x073a62);
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    camera.position.set(9, 10, 12);
    camera.lookAt(3.5, 0, 3.5);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(3.5, 0, 3.5); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.15; controls.minDistance = 6; controls.maxDistance = 24;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d8cab, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 2.3); light.position.set(3, 12, 9); scene.add(light);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(7.55, .16, 7.55), new THREE.MeshStandardMaterial({ color: 0x0c6689 })); platform.position.set(3.5, -.18, 3.5); scene.add(platform);
    for (const room of rooms) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(room.width - .025, .08, room.depth - .025), new THREE.MeshStandardMaterial({ color: room.color, roughness: 1 }));
      tile.position.set(room.x + room.width / 2, -.04, room.z + room.depth / 2); tile.userData.room = room.id; scene.add(tile);
    }
    for (const segment of walls) {
      const [ax, az] = segment.a; const [bx, bz] = segment.b;
      const length = Math.hypot(bx - ax, bz - az);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, .7, .095), new THREE.MeshStandardMaterial({ color: 0xf7fbfd, roughness: .85 }));
      wall.position.set((ax + bx) / 2, .35, (az + bz) / 2); wall.rotation.y = -Math.atan2(bz - az, bx - ax); scene.add(wall);
    }
    const furniture = (x: number, z: number, width: number, depth: number, height: number, color: number) => {
      const item = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
      item.position.set(x, height / 2, z); scene.add(item);
    };
    furniture(.45, 1.5, .38, 1.55, .28, 0xb4c2c8); // Living-room sofa
    furniture(1.25, 1.5, .9, .65, .2, 0xc6b6a4); // Coffee table
    furniture(2.8, .8, .45, .42, .38, 0xb2c0b7); // Side table
    furniture(6.15, 1.05, .86, .68, .33, 0xbcae9b); // Kitchen table
    furniture(5.7, .3, 1.45, .32, .35, 0xd0d7d4); // Kitchen counter
    furniture(1.2, 5.4, 1.25, 1.65, .23, 0xb9c6d0); // Bed
    furniture(1.2, 4.7, 1.1, .42, .28, 0xf9faf7); // Pillow
    furniture(4.4, 5.3, .65, .48, .4, 0xf3f6f7); // Bathroom basin
    furniture(4.45, 3.52, .32, .32, .45, 0x769c75); // Hall plant
    if (selectedMarker === "person") {
      const routePoints = route.map(([x, z]) => new THREE.Vector3(x, .09, z));
      const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(routePoints), new THREE.LineDashedMaterial({ color: 0x087dff, dashSize: .1, gapSize: .09, linewidth: 2 })); routeLine.computeLineDistances(); scene.add(routeLine);
    }
    const currentMarker = markers.find((item) => item.id === selectedMarker);
    if (currentMarker?.id === "person") {
      const person = new THREE.Group();
      const blue = new THREE.MeshStandardMaterial({ color: 0x0b7cfe, roughness: .65 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xf2c7a7, roughness: .75 });
      const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotationZ = 0) => {
        const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.rotation.z = rotationZ; mesh.userData.room = currentMarker.room; person.add(mesh);
      };
      part(new THREE.SphereGeometry(.09, 16, 12), skin, 0, .45, 0);
      part(new THREE.CapsuleGeometry(.08, .22, 4, 8), blue, 0, .24, 0);
      part(new THREE.CylinderGeometry(.035, .045, .2, 8), blue, -.09, .24, 0, -.25);
      part(new THREE.CylinderGeometry(.035, .045, .2, 8), blue, .09, .24, 0, .25);
      part(new THREE.CylinderGeometry(.04, .035, .23, 8), blue, -.05, .04, 0, -.12);
      part(new THREE.CylinderGeometry(.04, .035, .23, 8), blue, .05, .04, 0, .12);
      person.position.set(currentMarker.x, .08, currentMarker.z); scene.add(person);
    } else if (currentMarker) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(.13, 20, 12), new THREE.MeshStandardMaterial({ color: 0x35d7f2, emissive: 0x103f69 }));
      sphere.position.set(currentMarker.x, .22, currentMarker.z); sphere.userData.room = currentMarker.room; scene.add(sphere);
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
  }, [onSelect, onUnavailable, selectedMarker]);
  return <div className="sample-map-3d" ref={mount} role="img" aria-label={`Interactive 3D floor plan. Selected room: ${rooms.find((room) => room.id === selected)?.name}. Drag to rotate and click a room to select it.`} />;
}

function DemoFloorPlan2D({ selected, selectedMarker, onSelect, onMarker }: { selected: string; selectedMarker: string | null; onSelect: (room: string) => void; onMarker: (id: string, room: string) => void }) {
  return <svg className="sample-map-2d" viewBox="0 0 800 800" role="group" aria-label="Interactive 2D floor plan">
    <g transform="translate(50 50) scale(100)">
      {rooms.map((room) => <g key={room.id} role="button" tabIndex={0} aria-label={`Select ${room.name}`} onClick={() => onSelect(room.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(room.id); } }}>
        <rect x={room.x} y={room.z} width={room.width} height={room.depth} fill={`#${room.color.toString(16).padStart(6, "0")}`} className={selected === room.id ? "selected" : ""} />
      </g>)}
      {walls.map((wall, index) => <line key={index} x1={wall.a[0]} y1={wall.a[1]} x2={wall.b[0]} y2={wall.b[1]} className="sample-map-wall" />)}
      {selectedMarker === "person" && <polyline points={route.map(([x, z]) => `${x},${z}`).join(" ")} className="sample-map-route" />}
      {markers.filter((item) => item.id === selectedMarker).map((item) => <g key={item.id} className="sample-map-marker-group" transform={`translate(${item.x} ${item.z})`} role="button" tabIndex={0} aria-label={`Show ${item.label}`} onClick={() => onMarker(item.id, item.room)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onMarker(item.id, item.room); } }}>
        {item.id === "person" ? <g className="sample-map-person"><circle cx="0" cy="-.23" r=".085" /><path d="M 0 -.13 L 0 .12 M 0 -.04 L -.13 .05 M 0 -.04 L .13 .05 M 0 .12 L -.1 .27 M 0 .12 L .1 .27" /></g> : <g className="sample-map-object"><circle r=".14" /><path d="M -.07 -.07 L .08 .08 M .08 -.07 L -.07 .08" /></g>}
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
  const [selected, setSelected] = useState("living");
  const [marker, setMarker] = useState<string | null>(null);
  const room = rooms.find((item) => item.id === selected) ?? rooms[0];
  const selectedMarker = markers.find((item) => item.id === marker);
  return <div className="dashboard-page sample-map-page">
    <header className="page-heading-clean"><span className="eyebrow">ONE HOME</span><h2>Home map</h2><p>Select a recent memory to see its approximate location. Drag the 3D model to rotate it.</p></header>
    <div className="sample-map-layout"><section className="sample-map-stage panel"><div className="sample-map-toolbar"><div><span className="eyebrow">HOME MAP</span><h3>Map view</h3></div><div className="view-toggle" role="group" aria-label="Map view"><button className={view === "3d" ? "active" : ""} onClick={() => setView("3d")}>3D</button><button className={view === "2d" ? "active" : ""} onClick={() => setView("2d")}>2D</button></div></div>
      {view === "3d" ? <DemoThreeMap selected={selected} selectedMarker={marker} onSelect={setSelected} onUnavailable={fallbackTo2D} /> : <DemoFloorPlan2D selected={selected} selectedMarker={marker} onSelect={setSelected} onMarker={(id, room) => { setMarker(id); setSelected(room); }} />}
      <div className="sample-map-legend"><span><PersonStanding size={16} /> Person</span>{marker === "person" && <span><i /> Movement path</span>}<span><MapPin size={16} /> Approximate location</span></div></section>
      <aside className="sample-map-aside"><div className="panel"><span className="eyebrow">SELECTED ROOM</span><h3>{room.name}</h3><p>Approximate room geometry.</p><div className="sample-room-list">{rooms.map((item) => <button key={item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}>{item.name}</button>)}</div></div><div className="panel"><span className="eyebrow">LAST-SEEN MEMORY</span><h3>{selectedMarker?.label ?? "Select a memory"}</h3><p>{selectedMarker ? `Last observed in ${rooms.find((item) => item.id === selectedMarker.room)?.name}.` : "Choose a person or object to show its location."}</p><div className="sample-room-list"><button className={!marker ? "active" : ""} onClick={() => setMarker(null)}>Hide location</button>{markers.map((item) => <button key={item.id} className={marker === item.id ? "active" : ""} onClick={() => { setMarker(item.id); setSelected(item.room); }}>{item.label}<MoveUpRight size={14} /></button>)}</div></div></aside>
    </div>
  </div>;
}
