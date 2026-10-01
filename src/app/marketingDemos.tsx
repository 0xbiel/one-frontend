import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function disposeScene(scene: THREE.Scene) {
  scene.traverse(object => {
    if (object instanceof THREE.Sprite) {
      object.material.dispose();
      return;
    }
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments)) return;
    object.geometry.dispose();
    if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
    else object.material.dispose();
  });
}

function makeRoomLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 144;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(8, 8, 496, 128, 42);
  context.fill();
  context.fillStyle = color;
  context.font = "700 48px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), 256, 72, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.5, 0.42, 1);
  sprite.position.y = 0.22;
  return sprite;
}

function addRoom(group: THREE.Group, name: string, x: number, z: number, width: number, depth: number, color: number) {
  const floorMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.94 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), floorMaterial);
  floor.position.set(x, 0.06, z);
  floor.receiveShadow = true;
  group.add(floor);

  const label = makeRoomLabel(name, "#49627a");
  if (label) {
    label.position.set(x, 0.2, z);
    group.add(label);
  }
}

type DoorOpening = readonly [number, number] | undefined;

function addWallSegment(
  group: THREE.Group,
  axis: "horizontal" | "vertical",
  coordinate: number,
  start: number,
  end: number,
  opening: DoorOpening,
  material: THREE.Material,
) {
  const wallHeight = 0.62;
  const wallThickness = 0.09;
  const segments: [number, number][] = opening
    ? [[start, opening[0]], [opening[1], end]]
    : [[start, end]];
  for (const [segmentStart, segmentEnd] of segments) {
    if (segmentEnd - segmentStart < 0.04) continue;
    const length = segmentEnd - segmentStart;
    const geometry = axis === "horizontal"
      ? new THREE.BoxGeometry(length, wallHeight, wallThickness)
      : new THREE.BoxGeometry(wallThickness, wallHeight, length);
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(
      axis === "horizontal" ? (segmentStart + segmentEnd) / 2 : coordinate,
      0.11 + wallHeight / 2,
      axis === "horizontal" ? coordinate : (segmentStart + segmentEnd) / 2,
    );
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }
}

function addPin(group: THREE.Group, x: number, z: number, color: number) {
  const pin = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45 }),
  );
  stem.position.y = 0.39;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 18, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.32 }),
  );
  head.position.y = 0.62;
  pin.add(stem, head);
  pin.position.set(x, 0, z);
  group.add(pin);
}

export function SampleHomeMap3D() {
  const mount = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [view, setView] = useState<"2d" | "3d">("3d");

  useEffect(() => {
    if (view === "2d") return;
    const host = mount.current;
    if (!host) return;
    if (typeof WebGLRenderingContext === "undefined" && typeof WebGL2RenderingContext === "undefined") {
      setUnavailable(true);
      return;
    }

    let renderer: THREE.WebGLRenderer | undefined;
    let animationFrame = 0;
    let observer: ResizeObserver | undefined;
    const world = new THREE.Scene();
    const model = new THREE.Group();

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.touchAction = "none";
      host.replaceChildren(renderer.domElement);
    } catch {
      setUnavailable(true);
      disposeScene(world);
      return;
    }

    setUnavailable(false);
    world.add(new THREE.HemisphereLight(0xffffff, 0x9fb5c1, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.65);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    world.add(key);
    const fill = new THREE.DirectionalLight(0xb7d9e7, 0.65);
    fill.position.set(-4, 6, -4);
    world.add(fill);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(6.28, 0.18, 4.28),
      new THREE.MeshStandardMaterial({ color: 0xe0e8e6, roughness: 0.82 }),
    );
    base.position.y = -0.08;
    base.receiveShadow = true;
    model.add(base);

    // Four exact adjoining floor panels keep every room on one continuous footprint.
    addRoom(model, "Bedroom", -1.5, -1, 3, 2, 0xd1d9e8);
    addRoom(model, "Bath", 1.5, -1, 3, 2, 0xc3dce2);
    addRoom(model, "Living", -1.5, 1, 3, 2, 0xd8d2c6);
    addRoom(model, "Kitchen", 1.5, 1, 3, 2, 0xc6ded4);

    const walls = new THREE.MeshStandardMaterial({ color: 0xe8efed, roughness: 0.86 });
    const bounds = { minX: -3, maxX: 3, minZ: -2, maxZ: 2 };
    addWallSegment(model, "horizontal", bounds.minZ, bounds.minX, bounds.maxX, undefined, walls);
    addWallSegment(model, "horizontal", bounds.maxZ, bounds.minX, bounds.maxX, undefined, walls);
    addWallSegment(model, "vertical", bounds.minX, bounds.minZ, bounds.maxZ, undefined, walls);
    addWallSegment(model, "vertical", bounds.maxX, bounds.minZ, 0.68, undefined, walls);
    addWallSegment(model, "vertical", bounds.maxX, 1.32, bounds.maxZ, undefined, walls);
    // Doors line up with the route through the kitchen, living room, and bedroom.
    addWallSegment(model, "vertical", 0, bounds.minZ, -1.35, undefined, walls);
    addWallSegment(model, "vertical", 0, -0.65, 0, undefined, walls);
    addWallSegment(model, "vertical", 0, 0, 0.65, undefined, walls);
    addWallSegment(model, "vertical", 0, 1.35, bounds.maxZ, undefined, walls);
    addWallSegment(model, "horizontal", 0, bounds.minX, -0.85, undefined, walls);
    addWallSegment(model, "horizontal", 0, -0.15, bounds.maxX, undefined, walls);

    const routePoints = [
      new THREE.Vector3(3.05, 0.15, 1),
      new THREE.Vector3(2.7, 0.15, 1),
      new THREE.Vector3(0.25, 0.15, 1),
      new THREE.Vector3(-0.25, 0.15, 1),
      new THREE.Vector3(-0.5, 0.15, 0.75),
      new THREE.Vector3(-0.5, 0.15, 0.25),
      new THREE.Vector3(-0.5, 0.15, -0.25),
      new THREE.Vector3(-0.5, 0.15, -0.6),
      new THREE.Vector3(-1.5, 0.15, -1),
    ];
    const route = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(routePoints, false, "centripetal", 0), 64, 0.025, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x10a4e8, emissive: 0x087eb0, emissiveIntensity: 0.18 }),
    );
    model.add(route);
    addPin(model, 3.05, 1, 0x08a6e5);
    addPin(model, -1.5, -1, 0x43c6a0);
    world.add(model);

    const width = host.clientWidth || 640;
    const height = host.clientHeight || 420;
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(7.4, 7.1, 8.6);
    camera.lookAt(0, 0.15, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 5.2;
    controls.maxDistance = 11.5;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.35;
    controls.update();

    const render = () => {
      controls?.update();
      renderer?.render(world, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    const resize = () => {
      if (!renderer || !host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(host);
    } else {
      window.addEventListener("resize", resize);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
      controls?.dispose();
      disposeScene(world);
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [view]);

  return <div className={`one-tech-map-3d ${unavailable ? "is-static" : ""}`}>
    {view === "3d" && !unavailable && <div ref={mount} className="one-tech-map-3d-canvas" role="img" aria-label="Interactive illustrative 3D home map. Drag to rotate and scroll to zoom." />}
    {(view === "2d" || unavailable) && <SampleHomeMap2D />}
    <span className="one-tech-map-3d-label">SAMPLE HOME</span>
    <div className="one-tech-map-view-toggle" role="group" aria-label="Home map view">
      <button type="button" onClick={() => setView("3d")} aria-pressed={view === "3d"}>3D</button>
      <button type="button" onClick={() => setView("2d")} aria-pressed={view === "2d"}>2D</button>
    </div>
  </div>;
}

const publicHomeRooms = [
  { id: "bedroom", label: "Bedroom", x: 60, y: 60, width: 240, height: 140 },
  { id: "bath", label: "Bath", x: 300, y: 60, width: 240, height: 140 },
  { id: "living", label: "Living room", x: 60, y: 200, width: 240, height: 140 },
  { id: "kitchen", label: "Kitchen", x: 300, y: 200, width: 240, height: 140 },
];

export function SampleHomeMap2D({ selectedRoom, onSelectRoom }: { selectedRoom?: string; onSelectRoom?: (room: string) => void } = {}) {
  return <svg className="one-tech-map-2d" viewBox="0 0 600 400" role={onSelectRoom ? "group" : "img"} aria-label="Illustrative floor plan with separate bedroom, bathroom, living room, and kitchen">
    <rect x="0" y="0" width="600" height="400" fill="#edf2ef" />
    <g className="one-tech-map-floors">
      {publicHomeRooms.map(room => <rect key={room.id} x={room.x} y={room.y} width={room.width} height={room.height} fill={room.id === "bedroom" ? "#d1d9e8" : room.id === "bath" ? "#c3dce2" : room.id === "living" ? "#d8d2c6" : "#c6ded4"} className={selectedRoom === room.id ? "selected" : ""} role={onSelectRoom ? "button" : undefined} tabIndex={onSelectRoom ? 0 : undefined} aria-label={onSelectRoom ? `Select ${room.label}` : undefined} aria-pressed={onSelectRoom ? selectedRoom === room.id : undefined} onClick={onSelectRoom ? () => onSelectRoom(room.id) : undefined} onKeyDown={onSelectRoom ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectRoom(room.id); } } : undefined} />)}
    </g>
    <g className="one-tech-map-walls" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="square">
      <path d="M60 60H540M60 340H540M60 60V340M540 60V260M540 320V340" />
      <path d="M300 60V120M300 168V200M300 200V252M300 300V340" />
      <path d="M60 200H198M248 200H300M300 200H362M412 200H540" />
    </g>
    <g className="one-tech-map-labels" fill="#435a6d" fontFamily="Inter, Arial, sans-serif" fontSize="12" fontWeight="700" textAnchor="middle" pointerEvents="none">
      <text x="180" y="132">BEDROOM</text><text x="420" y="132">BATH</text>
      <text x="180" y="273">LIVING</text><text x="420" y="273">KITCHEN</text>
    </g>
    <path className="one-tech-home-route" d="M540 290H460H355H300H220V200V150H150" />
    <g className="one-tech-home-pins"><circle cx="540" cy="290" r="9" /><circle cx="150" cy="150" r="9" /></g>
    <g className="one-public-home-person" aria-label="Person located in the bedroom"><circle cx="145" cy="145" r="8" /><path d="M145 154v12m0-7-7 6m7-6 7 6m-7 1-6 9m6-9 6 9" /></g>
    <g className="one-public-home-object one-public-home-keys" aria-label="Keys in the kitchen"><circle cx="482" cy="280" r="8" /><path d="M478 280h9m-3 0v4m3-4v3" /></g>
    <g className="one-public-home-object one-public-home-mug" aria-label="Mug in the living room"><rect x="105" y="282" width="17" height="14" rx="3" /><path d="M122 285h4a4 4 0 0 1 0 8h-4M109 278v-3m7 3v-3" /></g>
  </svg>;
}

const checkinAnswers = [
  { question: "How are you feeling?", answer: "I’m feeling okay, thank you." },
  { question: "What happens next?", answer: "After breakfast, we can look at today’s plan together." },
  { question: "Where are my keys?", answer: "They were last seen on the kitchen table." },
];

export function SampleCheckinChat({ compact = false }: { compact?: boolean }) {
  const [answered, setAnswered] = useState<number[]>([]);
  const addResponse = (index: number) => setAnswered(current => current.includes(index) ? current : [...current, index]);
  const complete = answered.length === checkinAnswers.length;
  return <section className={`one-sample-checkin-chat${compact ? " is-compact" : ""}`} aria-label="Interactive daily check-in">
    <div className="one-sample-checkin-status"><span><i /> CHECK-IN</span><strong>3 short questions</strong></div>
    <div className="one-sample-checkin-messages" aria-live="polite">
      <p className="one-sample-checkin-message from-one">Good morning. Let’s take a moment for today’s check-in.</p>
      {answered.map(index => <div className="one-sample-checkin-turn" key={checkinAnswers[index].question}><p className="one-sample-checkin-message from-person">{checkinAnswers[index].question}</p><p className="one-sample-checkin-message from-one">{checkinAnswers[index].answer}</p></div>)}
    </div>
    <div className="one-sample-checkin-questions" aria-label="Quick check-in questions">
      {checkinAnswers.map((item, index) => <button type="button" key={item.question} aria-pressed={answered.includes(index)} onClick={() => addResponse(index)}>{item.question}</button>)}
    </div>
    <div className="one-sample-checkin-progress" role="status">{complete ? "Today’s check-in is complete" : answered.length ? "Response added to today’s check-in" : "Ready when you are"}<span>{answered.length} of 3 prompts</span></div>
  </section>;
}

export function SampleRouteMap() {
  const routePath = "M92 318H464V200H650V82";
  return <div className="one-tech-route-map">
    <svg viewBox="0 0 760 410" role="img" aria-label="Illustrative animated route from Home to Shop">
      <rect width="760" height="410" rx="18" fill="#edf3ee" />
      <g fill="none" strokeLinecap="square">
        <g stroke="#ffffff" strokeWidth="36">
          <path d="M0 82H760M0 200H760M0 318H760" />
          <path d="M92 0V410M278 0V410M464 0V410M650 0V410" />
        </g>
        <g stroke="#d8e0dc" strokeWidth="2">
          <path d="M0 82H760M0 200H760M0 318H760" />
          <path d="M92 0V410M278 0V410M464 0V410M650 0V410" />
        </g>
        <g stroke="#dfe5e1" strokeWidth="1" strokeDasharray="7 10">
          <path d="M0 82H760M0 200H760M0 318H760" />
          <path d="M92 0V410M278 0V410M464 0V410M650 0V410" />
        </g>
      </g>
      <g className="one-tech-city-buildings">
        <rect x="112" y="101" width="63" height="62" rx="5" fill="#d6e5d9" /><rect x="187" y="110" width="59" height="53" rx="5" fill="#dce9df" />
        <rect x="302" y="105" width="58" height="66" rx="5" fill="#dce8ed" /><rect x="374" y="112" width="62" height="52" rx="5" fill="#d3e1e8" />
        <rect x="489" y="102" width="54" height="61" rx="5" fill="#e3e5d7" /><rect x="557" y="107" width="65" height="56" rx="5" fill="#dce9df" />
        <rect x="120" y="229" width="55" height="57" rx="5" fill="#e3e5d7" /><rect x="187" y="222" width="61" height="67" rx="5" fill="#dce9df" />
        <rect x="304" y="226" width="60" height="59" rx="5" fill="#d6e5d9" /><rect x="379" y="224" width="56" height="64" rx="5" fill="#e3e5d7" />
        <rect x="489" y="225" width="61" height="61" rx="5" fill="#dce8ed" /><rect x="565" y="224" width="55" height="64" rx="5" fill="#d6e5d9" />
        <rect x="116" y="344" width="61" height="53" rx="5" fill="#dce8ed" /><rect x="190" y="342" width="55" height="55" rx="5" fill="#dce9df" />
        <rect x="301" y="342" width="58" height="55" rx="5" fill="#e3e5d7" /><rect x="375" y="343" width="62" height="54" rx="5" fill="#dce8ed" />
        <rect x="489" y="343" width="63" height="54" rx="5" fill="#dce9df" /><rect x="565" y="342" width="56" height="55" rx="5" fill="#e3e5d7" />
      </g>
      <path className="one-tech-route-path" pathLength="1" d={routePath} />
      <g className="one-tech-route-home"><circle cx="92" cy="318" r="16" /><circle cx="92" cy="318" r="6" /><rect x="48" y="341" width="88" height="28" rx="14" /><text x="92" y="360">Home</text></g>
      <g className="one-tech-route-shop"><circle cx="650" cy="82" r="16" /><circle cx="650" cy="82" r="6" /><rect x="611" y="38" width="78" height="28" rx="14" /><text x="650" y="57">Shop</text></g>
    </svg>
  </div>;
}
