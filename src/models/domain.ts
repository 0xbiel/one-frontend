export type Role = 'caregiver' | 'publisher';
export type DeviceStatus = 'online' | 'offline' | 'paused';
export type EventType = 'object.last_seen' | 'presence.changed' | 'clip.created' | 'device.status' | 'privacy.changed';

export interface Home { id: string; name: string; residentName: string; }
export interface Device { id: string; label: string; platform: string; status: DeviceStatus; lastSeenAt: string; }
export interface Session { actor: { id: string; role: Role | 'admin' | 'resident'; name: string }; home: Home; device?: Device | null; paused?: boolean; }
export interface Zone { id: string; name: string; x: number; y: number; width: number; height: number; }
export interface LastSeenObject {
  id: string; label: string; icon: string; status: 'seen' | 'unknown'; lastSeenAt: string | null;
  point: { x: number; y: number } | null; confidenceRadiusM: number; confidence: number;
  zone: Zone | null; sourceEventId: string | null;
}
export interface HomeEvent { id: string; type: EventType; title: string; detail: string; occurredAt: string; objectId?: string; clipId?: string; tone: 'blue' | 'green' | 'amber'; }
export interface Scene { sceneId: string; version: number; zones: Zone[]; mapId?: string | null; coordinateFrame?: string | null; }
export interface Consent { purpose: string; label: string; description: string; granted: boolean; required: boolean; }
