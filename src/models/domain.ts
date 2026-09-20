export type Role = 'caregiver' | 'publisher';
export type DeviceStatus = 'online' | 'offline' | 'paused';
export type EventType = 'object.last_seen' | 'presence.changed' | 'daily.check_in' | 'fall.suspected' | 'clip.created' | 'device.status' | 'privacy.changed';
export type MapDimension = '2d' | '3d';
export type MapSource = 'camera-cv-2d' | 'roomplan-lidar-3d' | 'arkit-video-3d' | 'legacy-2d';
export type GeometryStatus = 'collecting' | 'processing' | 'ready' | 'needs_rescan' | 'unavailable' | 'failed' | 'legacy' | string;

export interface Home {
  id: string;
  name: string;
  residentName: string;
  careSetting?: 'home' | 'residence';
  supportFocus?: 'general' | 'mci';
}
export interface Device {
  id: string;
  label: string;
  platform: string;
  status: DeviceStatus;
  lastSeenAt: string;
  roomId?: string | null;
  calibration_needed?: boolean;
  roomplan_registration_status?: string;
  roomplan_map_id?: string | null;
  metadata?: Record<string, unknown>;
}
export interface Session { actor: { id: string; role: Role | 'admin' | 'resident'; name: string }; home: Home; device?: Device | null; paused?: boolean; }
export interface Point2D { x: number; y: number; }
export interface Point3D { x: number; y: number; z: number; }
export interface PolygonGeometry { id: string; label?: string; points: Point2D[]; confidence?: number; }
export interface WallGeometry { id: string; points: Point2D[]; confidence?: number; start?: Point3D; end?: Point3D; height?: number; }
export interface SurfaceGeometry { id: string; kind?: string; vertices: Point3D[]; faces?: number[] | number[][]; confidence?: number; }
export interface MeshGeometry { vertices: Point3D[]; faces: number[] | number[][]; }
export interface RoomObjectGeometry { id: string; label?: string; position: Point3D; dimensions: Point3D; confidence?: number; }
export interface RoomZone3D {
  id: string;
  label: string;
  polygon: Array<{ x: number; z: number }>;
  floorY: number;
  story?: number;
  confidence?: number;
}
export interface FurnitureGeometry {
  id: string;
  label: string;
  center: Point2D;
  size: Point2D;
  rotationDegrees?: number;
  confidence?: number;
}
export type OpeningKind = 'door' | 'window';
export interface OpeningGeometry {
  id: string;
  kind: OpeningKind;
  start: Point2D;
  end: Point2D;
  confidence?: number;
}
export interface MapScale {
  status: 'measured_reference';
  method: 'caregiver_reference';
  metersPerNormalizedUnit: number;
  referenceLengthM: number;
  referenceLabel: string;
  referencePoints?: { start: Point2D; end: Point2D };
  measuredAt?: string;
}
export interface RoomGeometry {
  coordinateSpace?: string;
  polygons: PolygonGeometry[];
  walls: WallGeometry[];
  surfaces?: SurfaceGeometry[];
  mesh?: MeshGeometry;
  objects?: RoomObjectGeometry[];
  furniture?: FurnitureGeometry[];
  openings?: OpeningGeometry[];
  roomZones?: RoomZone3D[];
}
export interface CameraPose { position?: Point2D; position3d?: Point3D; headingDegrees?: number; fovDegrees?: number; confidence?: number; }
export interface CameraRegistration {
  status: 'positioned' | 'needs_rescan' | 'unavailable';
  cameraId?: string | null;
  cameraName?: string | null;
  roomId?: string | null;
  mapId?: string | null;
  coordinateFrame: string;
  cameraToWorld?: number[][] | null;
  confidence?: number | null;
  trackingState?: string | null;
  source: string;
  intrinsics?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  referenceSnapshot?: {
    capturedAt?: string | null;
    mapId?: string | null;
    width?: number | null;
    height?: number | null;
    downloadPath?: string | null;
  } | null;
}
export interface Zone { id: string; name: string; x: number; y: number; width: number; height: number; polygon?: Point2D[]; confidence?: number; }
export interface LastSeenObject {
  id: string; label: string; icon: string; status: 'seen' | 'unknown'; lastSeenAt: string | null;
  point: { x: number; y: number } | null; confidenceRadiusM: number; confidence: number;
  worldPoint?: Point3D | null; mapId?: string | null; cameraId?: string | null; roomId?: string | null;
  presenceState?: 'current' | 'recent' | 'stale' | null;
  zone: Zone | null; sourceEventId: string | null;
}
export interface HomeEvent { id: string; type: EventType; title: string; detail: string; occurredAt: string; objectId?: string; clipId?: string; status?: string; confidence?: number; careRecipientId?: string | null; snapshotPath?: string | null; snapshotContentType?: string | null; tone: 'blue' | 'green' | 'amber'; }
export type CheckInStatus = 'stable' | 'attention' | 'unknown';
export type CheckInTrend = 'stable' | 'improving' | 'changing' | 'unknown';
export interface DailyCheckInResult {
  id: string;
  event_id?: string;
  care_recipient_id?: string | null;
  status: CheckInStatus;
  trend: CheckInTrend;
  explanation: string;
  evidence_ids?: string[];
  limitations: string;
  degraded?: boolean;
  inference_status?: string;
  model_version?: string;
}
export interface AnalyticsDay { date: string; count: number; }
export interface FallAnalytics {
  window_days: number;
  total_signals: number;
  needs_review: number;
  reviewed: number;
  last_signal_at?: string | null;
  trend: 'stable' | 'increasing' | 'decreasing' | 'unknown';
  by_day: AnalyticsDay[];
  recent: Array<{ id: string; status?: string; confidence?: number | null; explanation?: string | null; occurred_at?: string | null }>;
  limitations: string[];
}
export interface DailyCheckInAnalytics {
  window_days: number;
  total: number;
  completed_today: number;
  status_counts: Record<string, number>;
  last_recorded_at?: string | null;
  last_status?: CheckInStatus | null;
  last_trend?: CheckInTrend | null;
  last_explanation?: string | null;
  trend: 'stable' | 'increasing' | 'decreasing' | 'unknown';
  by_day: AnalyticsDay[];
  recent: Array<{ id: string; status?: string; trend?: string; explanation?: string | null; recorded_at?: string | null }>;
  limitations: string[];
}
export interface CareAnalytics {
  window_days: number;
  fall: FallAnalytics;
  daily_check_in: DailyCheckInAnalytics;
  event_counts: Record<string, number>;
  assistant_context: { includes: string[]; excludes: string[] };
  limitations: string[];
}
export interface Scene {
  sceneId: string;
  version: number;
  zones: Zone[];
  mapId?: string | null;
  coordinateFrame?: string | null;
  dimension: MapDimension;
  source: MapSource;
  confidence?: number | null;
  metricScaleKnown: boolean;
  scale?: MapScale;
  walls?: WallGeometry[];
  camera?: CameraPose;
  cameraRegistration?: CameraRegistration;
  cameraRegistrations?: CameraRegistration[];
  geometry?: RoomGeometry;
  geometryStatus?: GeometryStatus;
  modelVersion?: string | null;
}
export interface Consent { purpose: string; label: string; description: string; granted: boolean; required: boolean; }
