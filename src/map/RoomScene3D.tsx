import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LastSeenObject, Scene } from '../models/domain';

export function RoomScene3D({ scene, objects, selectedId, onSelect }: { scene: Scene; objects: LastSeenObject[]; selectedId?: string; onSelect: (id: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mount.current) return;
    const host = mount.current;
    const width = host.clientWidth || 600;
    const height = host.clientHeight || 400;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(width, height); renderer.setClearColor(0x17191f, 1); host.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100); camera.position.set(8, 8, 10); camera.lookAt(0, 0, 0);
    const world = new THREE.Scene(); world.add(new THREE.HemisphereLight(0xddeaff, 0x263044, 2));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshStandardMaterial({ color: 0x2a303b, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; world.add(floor);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10, .03, 7)), new THREE.LineBasicMaterial({ color: 0x667383 })); line.position.y = .02; world.add(line);
    const palette = [0x36557c, 0x315a6b, 0x554a79, 0x4d5a3c];
    scene.zones.forEach((zone, index) => { const w = Math.max(1, zone.width / 10 * 7); const d = Math.max(1, zone.height / 10 * 7); const room = new THREE.Mesh(new THREE.BoxGeometry(w, .06, d), new THREE.MeshStandardMaterial({ color: palette[index % palette.length], transparent: true, opacity: .68 })); room.position.set((zone.x - 50) / 13, .07, (zone.y - 45) / 13); world.add(room); });
    const markers: { object: LastSeenObject; mesh: THREE.Mesh }[] = [];
    objects.filter((object) => object.point).forEach((object) => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(object.id === selectedId ? .23 : .17, 18, 18), new THREE.MeshStandardMaterial({ color: object.id === selectedId ? 0x45d6e2 : 0x1769e8, emissive: object.id === selectedId ? 0x45d6e2 : 0x1769e8, emissiveIntensity: .35 })); mesh.position.set((object.point!.x - 50) / 13, .3, (object.point!.y - 45) / 13); world.add(mesh); markers.push({ object, mesh }); });
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const handleClick = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(markers.map((item) => item.mesh))[0]; if (hit) onSelect(markers.find((item) => item.mesh === hit.object)!.object.id); }; renderer.domElement.addEventListener('pointerup', handleClick);
    let frame = 0; const animate = () => { renderer.render(world, camera); frame = requestAnimationFrame(animate); }; animate();
    return () => { cancelAnimationFrame(frame); renderer.domElement.removeEventListener('pointerup', handleClick); renderer.dispose(); host.replaceChildren(); };
  }, [scene, objects, selectedId, onSelect]);
  return <div className="three-scene" ref={mount} aria-label="Interactive 3D RoomPlan-derived room map" role="img" />;
}
