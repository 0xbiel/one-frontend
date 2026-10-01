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

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8efed, roughness: 0.86 });
  const wallHeight = 0.62;
  const wallThickness = 0.09;
  const wall = (wallX: number, wallZ: number, wallWidth: number, wallDepth: number, height = wallHeight) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, height, wallDepth), wallMaterial);
    mesh.position.set(wallX, 0.13 + height / 2, wallZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  wall(x, z - depth / 2, width, wallThickness);
  wall(x - width / 2, z, wallThickness, depth);
  wall(x + width / 2, z, wallThickness, depth);
  wall(x, z + depth / 2, width * 0.37, wallThickness, wallHeight * 0.58);
  wall(x + width * 0.34, z + depth / 2, width * 0.32, wallThickness, wallHeight * 0.58);

  const label = makeRoomLabel(name, "#49627a");
  if (label) {
    label.position.set(x, 0.2, z);
    group.add(label);
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

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(6.1, 0.22, 5.1),
      new THREE.MeshStandardMaterial({ color: 0xe0e8e6, roughness: 0.82 }),
    );
    base.position.y = -0.08;
    base.receiveShadow = true;
    model.add(base);

    addRoom(model, "Living", -1.38, 0.48, 2.7, 2.15, 0xd8d2c6);
    addRoom(model, "Kitchen", 1.18, 0.48, 2.36, 2.15, 0xc6ded4);
    addRoom(model, "Bedroom", -1.38, -1.72, 2.7, 1.9, 0xd1d9e8);
    addRoom(model, "Bath", 1.18, -1.72, 2.36, 1.9, 0xc3dce2);

    const routePoints = [
      new THREE.Vector3(-2.15, 0.21, 0.84),
      new THREE.Vector3(-0.55, 0.21, 0.84),
      new THREE.Vector3(0.45, 0.21, 0.37),
      new THREE.Vector3(1.55, 0.21, 0.66),
    ];
    const route = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(routePoints), 48, 0.025, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x10a4e8, emissive: 0x087eb0, emissiveIntensity: 0.18 }),
    );
    model.add(route);
    addPin(model, -2.15, 0.84, 0x08a6e5);
    addPin(model, 1.55, 0.66, 0x43c6a0);
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
  return <div className="one-tech-route-map">
    <svg viewBox="0 0 760 410" role="img" aria-label="Illustrative animated route from Home to Shop">
      <rect width="760" height="410" rx="18" fill="#f4f4ef" />
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M-30 115 225 -25M-30 320 460 -30M180 440 790 78M435 445 775 250M-25 225 785 185" strokeWidth="42" />
        <path d="M-30 115 225 -25M-30 320 460 -30M180 440 790 78M435 445 775 250M-25 225 785 185" stroke="#e2e3dd" strokeWidth="2" />
      </g>
      <g fill="#dcebe2"><path d="M64 30h95v53H64zM282 39h82v61h-82zM476 23h87v66h-87zM575 220h104v63H575zM98 290h91v73H98zM360 286h105v62H360z" /></g>
      <g fill="#d7e5f2"><path d="M230 280h83v55h-83zM540 115h83v51h-83zM32 164h75v43H32z" /></g>
      <path className="one-tech-route-path" pathLength="1" d="M132 321C182 293 197 239 260 229S367 246 415 196s87-62 148-60" />
      <g className="one-tech-route-home"><circle cx="132" cy="321" r="16" /><circle cx="132" cy="321" r="6" /><rect x="93" y="342" width="79" height="30" rx="15" /><text x="132" y="362">Home</text></g>
      <g className="one-tech-route-shop"><circle cx="563" cy="136" r="16" /><circle cx="563" cy="136" r="6" /><rect x="525" y="91" width="76" height="30" rx="15" /><text x="563" y="111">Shop</text></g>
    </svg>
    <span className="one-tech-route-marker" aria-hidden="true" />
  </div>;
}
