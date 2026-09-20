import type { Consent, Device, Home, HomeEvent, LastSeenObject, Scene, Session } from '../models/domain';

export const demoHome: Home = { id: 'home-demo', name: 'The García home', residentName: 'María' };
export const demoDevice: Device = { id: 'device-demo', label: 'Hallway iPhone', platform: 'iOS Safari', status: 'online', lastSeenAt: new Date().toISOString() };
export const demoSession: Session = { actor: { id: 'caregiver-demo', role: 'caregiver', name: 'Clara García' }, home: demoHome, device: demoDevice };
export const demoScene: Scene = {
  sceneId: 'scene-demo', version: 3,
  dimension: '2d',
  source: 'camera-cv-2d',
  confidence: 0.88,
  metricScaleKnown: false,
  geometryStatus: 'ready',
  modelVersion: 'demo-camera-room-layout',
  cameraRegistrations: [
    { status: 'positioned', cameraId: 'camera-online-demo', cameraName: 'Living room camera', coordinateFrame: 'roomplan-local', source: 'demo', confidence: 0.98 },
    { status: 'unavailable', cameraId: 'camera-offline-demo', cameraName: 'Bedroom camera', coordinateFrame: 'roomplan-local', source: 'demo', confidence: 0 },
  ],
  zones: [
    { id: 'living', name: 'Living room', x: 5, y: 18, width: 47, height: 56, polygon: [{ x: 5, y: 18 }, { x: 52, y: 18 }, { x: 52, y: 74 }, { x: 5, y: 74 }], confidence: 0.92 },
    { id: 'entry', name: 'Entryway', x: 54, y: 18, width: 19, height: 28, polygon: [{ x: 54, y: 18 }, { x: 73, y: 18 }, { x: 73, y: 46 }, { x: 54, y: 46 }], confidence: 0.84 },
    { id: 'kitchen', name: 'Kitchen', x: 54, y: 50, width: 37, height: 24, polygon: [{ x: 54, y: 50 }, { x: 91, y: 50 }, { x: 91, y: 74 }, { x: 54, y: 74 }], confidence: 0.86 },
    { id: 'bedroom', name: 'Bedroom', x: 76, y: 18, width: 15, height: 24, polygon: [{ x: 76, y: 18 }, { x: 91, y: 18 }, { x: 91, y: 42 }, { x: 76, y: 42 }], confidence: 0.79 },
  ],
  geometry: {
    coordinateSpace: 'percentage',
    polygons: [
      { id: 'living', label: 'Living room', points: [{ x: 5, y: 18 }, { x: 52, y: 18 }, { x: 52, y: 74 }, { x: 5, y: 74 }], confidence: 0.92 },
      { id: 'entry', label: 'Entryway', points: [{ x: 54, y: 18 }, { x: 73, y: 18 }, { x: 73, y: 46 }, { x: 54, y: 46 }], confidence: 0.84 },
      { id: 'kitchen', label: 'Kitchen', points: [{ x: 54, y: 50 }, { x: 91, y: 50 }, { x: 91, y: 74 }, { x: 54, y: 74 }], confidence: 0.86 },
      { id: 'bedroom', label: 'Bedroom', points: [{ x: 76, y: 18 }, { x: 91, y: 18 }, { x: 91, y: 42 }, { x: 76, y: 42 }], confidence: 0.79 },
    ],
    walls: [
      { id: 'wall-north', points: [{ x: 5, y: 18 }, { x: 91, y: 18 }] },
      { id: 'wall-west', points: [{ x: 5, y: 18 }, { x: 5, y: 74 }] },
      { id: 'wall-south', points: [{ x: 5, y: 74 }, { x: 91, y: 74 }] },
      { id: 'wall-east', points: [{ x: 91, y: 18 }, { x: 91, y: 74 }] },
    ],
    furniture: [
      { id: 'demo-bed', label: 'Bed', center: { x: 83.5, y: 30 }, size: { x: 10, y: 9 }, confidence: 0.86 },
      { id: 'demo-table', label: 'Table', center: { x: 35, y: 47 }, size: { x: 9, y: 8 }, confidence: 0.8 },
      { id: 'demo-sofa', label: 'Sofa', center: { x: 28, y: 67 }, size: { x: 19, y: 5 }, confidence: 0.78 },
    ],
    openings: [
      { id: 'demo-door', kind: 'door', start: { x: 58, y: 74 }, end: { x: 66, y: 74 }, confidence: 0.84 },
      { id: 'demo-window', kind: 'window', start: { x: 16, y: 18 }, end: { x: 30, y: 18 }, confidence: 0.89 },
    ],
  },
};
export const demoObjects: LastSeenObject[] = [
  { id: 'keys', label: 'Keys', icon: '⌁', status: 'seen', lastSeenAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), point: { x: 64, y: 33 }, confidenceRadiusM: 0.8, confidence: 0.74, zone: demoScene.zones[1], sourceEventId: 'evt-keys' },
  { id: 'glasses', label: 'Reading glasses', icon: '◌', status: 'seen', lastSeenAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(), point: { x: 31, y: 48 }, confidenceRadiusM: 0.45, confidence: 0.91, zone: demoScene.zones[0], sourceEventId: 'evt-glasses' },
  { id: 'medication', label: 'Medication box', icon: '+', status: 'unknown', lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), point: null, confidenceRadiusM: 1.8, confidence: 0.32, zone: demoScene.zones[2], sourceEventId: 'evt-medication' },
];
export const demoEvents: HomeEvent[] = [
  { id: 'evt-keys', type: 'object.last_seen', title: 'Keys last seen', detail: 'Near the entryway console', occurredAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), objectId: 'keys', tone: 'blue' },
  { id: 'evt-checkin', type: 'presence.changed', title: 'Morning check-in complete', detail: 'María answered 4 of 4 prompts', occurredAt: new Date(Date.now() - 1000 * 60 * 52).toISOString(), tone: 'green' },
  { id: 'evt-glasses', type: 'object.last_seen', title: 'Reading glasses last seen', detail: 'On the living room side table', occurredAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(), objectId: 'glasses', tone: 'blue' },
  { id: 'evt-clip', type: 'clip.created', title: 'A short clip is ready', detail: 'Movement near the kitchen, 8 seconds', occurredAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), clipId: 'clip-demo', tone: 'amber' },
];
export const consentDefaults: Consent[] = [
  { purpose: 'video_capture', label: 'Camera capture', description: 'Use the camera to support the daily check-in.', granted: false, required: true },
  { purpose: 'audio_capture', label: 'Microphone', description: 'Use voice so María can answer naturally.', granted: false, required: true },
  { purpose: 'analytics', label: 'Change insights', description: 'Compare observations with María’s personal baseline.', granted: true, required: false },
  { purpose: 'clip_storage', label: 'Short clips', description: 'Keep short, meaningful clips for the caregiver.', granted: true, required: false },
];
