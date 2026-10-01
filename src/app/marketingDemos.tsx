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
  floor.position.set(x, 0.08, z);
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
      0.13 + wallHeight / 2,
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

  useEffect(() => {
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

    const footprint = new THREE.Shape();
    footprint.moveTo(-3, 3);
    footprint.lineTo(1, 3);
    footprint.lineTo(1, 0.65);
    footprint.lineTo(2.55, 0.65);
    footprint.lineTo(2.55, -1.7);
    footprint.lineTo(-3, -1.7);
    footprint.closePath();
    const base = new THREE.Mesh(
      new THREE.ExtrudeGeometry(footprint, { depth: 0.16, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.07, bevelThickness: 0.04 }),
      new THREE.MeshStandardMaterial({ color: 0xe0e8e6, roughness: 0.82 }),
    );
    base.geometry.rotateX(-Math.PI / 2);
    base.position.y = -0.08;
    base.receiveShadow = true;
    model.add(base);

    addRoom(model, "Living", -1.425, 0.2, 3.15, 3, 0xd8d2c6);
    addRoom(model, "Kitchen", 1.35, 0.525, 2.4, 2.35, 0xc6ded4);
    addRoom(model, "Bedroom", -1.825, -2.15, 2.35, 1.7, 0xd1d9e8);
    addRoom(model, "Bath", 0.175, -1.825, 1.65, 2.35, 0xc3dce2);

    const walls = new THREE.MeshStandardMaterial({ color: 0xe8efed, roughness: 0.86 });
    // The stepped outline follows the four rooms; every interior opening is left clear.
    addWallSegment(model, "horizontal", -3, -3, 1, undefined, walls);
    addWallSegment(model, "vertical", -3, -3, 1.7, undefined, walls);
    addWallSegment(model, "vertical", 1, -3, -0.65, undefined, walls);
    addWallSegment(model, "horizontal", -0.65, 1, 2.55, undefined, walls);
    addWallSegment(model, "vertical", 2.55, -0.65, 1.7, [0.3, 0.98], walls);
    addWallSegment(model, "horizontal", 1.7, -3, 2.55, undefined, walls);
    addWallSegment(model, "horizontal", -1.3, -3, -0.65, [-2.25, -1.55], walls);
    addWallSegment(model, "vertical", -0.65, -3, -1.3, [-2.4, -1.7], walls);
    addWallSegment(model, "horizontal", -0.65, 0.15, 1, [0.32, 0.78], walls);
    addWallSegment(model, "vertical", 0.15, -0.65, 1.7, [0.25, 0.95], walls);

    const routePoints = [
      new THREE.Vector3(3.05, 0.21, 0.65),
      new THREE.Vector3(2.55, 0.21, 0.65),
      new THREE.Vector3(1.2, 0.21, 0.65),
      new THREE.Vector3(0.15, 0.21, 0.65),
      new THREE.Vector3(-0.15, 0.21, 0.65),
      new THREE.Vector3(-1.82, 0.21, -1.22),
      new THREE.Vector3(-1.82, 0.21, -1.3),
      new THREE.Vector3(-1.82, 0.21, -1.92),
      new THREE.Vector3(-2.15, 0.21, -2.2),
    ];
    const route = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(routePoints, false, "centripetal", 0), 64, 0.025, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x10a4e8, emissive: 0x087eb0, emissiveIntensity: 0.18 }),
    );
    model.add(route);
    addPin(model, 3.05, 0.65, 0x08a6e5);
    addPin(model, -2.15, -2.2, 0x43c6a0);
    world.add(model);

    const width = host.clientWidth || 640;
    const height = host.clientHeight || 420;
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(6.9, 6.8, 7.8);
    camera.lookAt(0, 0.15, -0.45);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.1, -0.45);
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
  }, []);

  return <div className={`one-tech-map-3d ${unavailable ? "is-static" : ""}`}>
    <div ref={mount} className="one-tech-map-3d-canvas" role="img" aria-label="Interactive illustrative 3D home map. Drag to rotate and scroll to zoom." />
    {unavailable && <img className="one-tech-map-3d-fallback" src="/product-assets/home-map-3d-reference.webp" alt="Illustrative 3D home map concept" />}
    <span className="one-tech-map-3d-label">SAMPLE HOME</span>
  </div>;
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
