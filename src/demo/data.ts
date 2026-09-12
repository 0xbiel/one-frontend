import type { Consent, Device, Home, HomeEvent, LastSeenObject, Scene, Session } from '../models/domain';

export const demoHome: Home = { id: 'home-demo', name: 'The García home', residentName: 'María' };
export const demoDevice: Device = { id: 'device-demo', label: 'Hallway iPhone', platform: 'iOS Safari', status: 'online', lastSeenAt: new Date().toISOString() };
export const demoSession: Session = { actor: { id: 'caregiver-demo', role: 'caregiver', name: 'Clara García' }, home: demoHome, device: demoDevice };
export const demoScene: Scene = {
  sceneId: 'scene-demo', version: 3,
  zones: [
    { id: 'living', name: 'Living room', x: 5, y: 18, width: 47, height: 56 },
    { id: 'entry', name: 'Entryway', x: 54, y: 18, width: 19, height: 28 },
    { id: 'kitchen', name: 'Kitchen', x: 54, y: 50, width: 37, height: 24 },
    { id: 'bedroom', name: 'Bedroom', x: 76, y: 18, width: 15, height: 24 },
  ],
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
