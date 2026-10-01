import type {
  CameraRegistration,
  CameraPose,
  Device,
  FurnitureGeometry,
  GeometryStatus,
  HomeEvent,
  LastSeenObject,
  MapDimension,
  MapScale,
  MapSource,
  Point2D,
  PolygonGeometry,
  RoomGeometry,
  OpeningGeometry,
  Scene,
  Session,
  WallGeometry,
  Zone,
} from '../models/domain';
import { demoDevice, demoEvents, demoObjects, demoScene, demoSession } from '../demo/data';
import type { paths } from './schema';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL;
export const API_BASE = configuredApiBase && configuredApiBase !== '/api/v1'
  ? configuredApiBase
  : import.meta.env.DEV
    ? 'http://localhost:8000/api/v1'
    : '/api/v1';
// Live API is the safe default. Demo data must be explicitly enabled.
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
let demoMapScale: MapScale | undefined;
let demoActiveCareSpaceId = 'home-demo';
const demoCareSpaces: CareSpaceSummary[] = [
  { id: 'home-demo', name: 'The García home', residentName: 'María', careSetting: 'home', supportFocus: 'general', role: 'admin', active: true },
  { id: 'home-demo-2', name: 'Casa dels avis', residentName: 'Joan', careSetting: 'home', supportFocus: 'general', role: 'caregiver', active: false },
];
const demoCareRecipients: Record<string, CareRecipient[]> = {
  'home-demo': [
    { id: 'recipient-maria', display_name: 'María García', relationship: 'Mother', room_label: 'Main bedroom', created_at: '2026-01-01T00:00:00Z' },
    { id: 'recipient-manuel', display_name: 'Manuel García', relationship: 'Partner', room_label: 'Main bedroom', created_at: '2026-01-02T00:00:00Z' },
  ],
  'home-demo-2': [
    { id: 'recipient-joan', display_name: 'Joan', relationship: 'Grandfather', room_label: null, created_at: '2026-01-03T00:00:00Z' },
  ],
};

interface RequestOptions extends RequestInit { auth?: boolean; }
type JsonBody<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends { requestBody?: { content?: { 'application/json'?: infer Body } } } ? Body : never;
type PairStartInput = JsonBody<'/api/v1/pairing/start', 'post'>;
type LiveKitInput = JsonBody<'/api/v1/homes/{home_id}/livekit/token', 'post'>;
interface PairStartResponse { pairing_id?: string; pairing_code: string; code?: string; expires_in_seconds: number; home_id: string; user_id: string; role?: 'admin' | 'resident' | 'caregiver' | 'publisher' | string; }
interface PairCompleteResponse { access_token: string; token_type: string; expires_in: number; home_id: string; user_id: string; reconnect_token?: string | null; }
export interface PairingStatus { pairing_id: string; home_id: string; status: 'pending' | 'connected' | 'expired'; expires_at: string; connected_at?: string | null; device: { id: string; label: string; role: string }; }
export interface EmailChallenge { verification_id: string; expires_in_seconds: number; delivery: string; dev_code?: string | null; email: string; purpose: 'create' | 'login'; home_id: string; user_id: string; role: string; }
export interface EmailSession extends PairCompleteResponse { role?: string; email?: string; }
export interface CareSpaceSummary {
  id: string;
  name: string;
  residentName: string;
  careSetting: 'home' | 'residence';
  supportFocus: 'general' | 'mci';
  role: 'admin' | 'resident' | 'caregiver';
  active: boolean;
}
export interface CareSpaceCreateInput { name: string; careSetting: 'home' | 'residence'; supportFocus: 'general' | 'mci'; }
export interface CaregiverSummary {
  id: string;
  status: 'stable' | 'attention' | 'unknown';
  trend: string;
  explanation: string;
  limitations: string;
  evidenceIds: string[];
  createdAt: string;
}
export interface CheckInQuestion {
  id: string;
  summaryId: string;
  question: string;
  answer: string;
  responseTimeMs: number | null;
  baselineMs: number | null;
  pulseBpm: number | null;
  askedAt: string;
}
export interface DailyCheckInInput {
  subjectUserId?: string | null;
  questions: Array<{ question: string; answer: string; responseTimeMs: number | null; baselineMs: number | null; pulseBpm: number | null }>;
}
const demoDailyQuestions: CheckInQuestion[] = [];
interface BackendCheckInQuestion {
  id: string; summary_id: string; question: string; answer: string;
  response_time_ms: number | null; baseline_ms: number | null;
  pulse_bpm: number | null; asked_at: string;
}
interface BackendCaregiverSummary {
  id: string; status: string; trend: string; explanation: string;
  limitations: string; evidence_json: string; created_at: string;
}
interface CareSpaceSession extends PairCompleteResponse { role: 'admin' | 'resident' | 'caregiver'; }
interface InviteAcceptResponse extends PairCompleteResponse { role?: string; }
interface LiveKitResponse { url: string; token: string; expires_in: number; mode?: 'auto' | 'publish' | 'subscribe'; }
interface BackendEvent { id: string; event_type: string; status?: string; explanation?: string; confidence?: number; evidence_ids?: string; evidence_json?: string; first_seen_at?: string; last_seen_at?: string; source?: { camera_id?: string | null; camera_name?: string | null; room_name?: string | null; object_id?: string | null } | null; }
interface MeResponse { actor: Session['actor']; home: Session['home']; device: Device | null; paused: boolean; }
interface SceneResponse {
  sceneId: string | null;
  version: number;
  zones?: Array<Partial<Zone> & { polygon?: unknown }>;
  mapId?: string | null;
  coordinateFrame?: string | null;
  source?: MapSource;
  dimension?: MapDimension;
  confidence?: number | null;
  metricScaleKnown?: boolean;
  scale?: unknown;
  walls?: unknown;
  camera?: unknown;
  cameraRegistration?: unknown;
  cameraRegistrations?: unknown;
  geometry?: unknown;
  geometryStatus?: GeometryStatus;
  rescanRequired?: boolean;
  modelVersion?: string | null;
}
export interface MapResponse {
  id: string;
  revision: number;
  coordinate_frame: string;
  room_id?: string | null;
  created_at?: string;
  source?: MapSource;
  dimension?: MapDimension;
  metadata?: Record<string, unknown>;
  scale?: unknown;
  geometry_status?: GeometryStatus;
  rescan_required?: boolean;
  confidence?: number | null;
  model_version?: string | null;
  map_data?: {
    geometry?: unknown;
    [key: string]: unknown;
  };
}
export type MapGenerationStatus = 'collecting' | 'processing' | 'ready' | 'needs_rescan' | 'unavailable' | 'failed';
export interface MapGenerationFrame { frame_base64: string; width: number; height: number; captured_at?: string; }
export interface CameraLocalizationPersonAnchor { frame_index: number; x: number; y: number; z: number; }
export interface CameraLocalizationResponse {
  id: string;
  status: 'positioned' | 'needs_rescan';
  camera_id: string;
  map_id: string;
  coordinate_frame: 'roomplan-local';
  camera_to_world?: number[][] | null;
  confidence?: number | null;
  tracking_state: string;
  source: string;
  inlier_count: number;
  match_count: number;
  reprojection_error_px?: number | null;
  intrinsics_source: string;
  diagnostics?: Record<string, unknown>;
  review_required?: boolean;
}
export interface CameraLocalizationCandidateTrace {
  kind?: 'visual-pnp' | 'semantic-cuboid';
  frame_index?: number | null;
  landmark_view_id?: string | null;
  camera_center: number[];
  distance_to_reference_m?: number | null;
  inlier_count: number;
  match_count: number;
  reprojection_error_px?: number | null;
  consensus_frame_count: number;
  consensus_scan_view_count: number;
  scene_plausible: boolean;
  scene_reason?: string | null;
  selected_fov_degrees?: number | null;
  cuboid_score?: number | null;
  mean_iou?: number | null;
  minimum_iou?: number | null;
  matched_object_count?: number;
  semantic_group_count?: number;
  labels?: string[];
}
export interface CameraLocalizationAttemptTrace {
  id: string;
  created_at?: string | null;
  status: 'positioned' | 'needs_rescan';
  storage_status?: string | null;
  confidence?: number | null;
  inlier_count: number;
  match_count: number;
  reprojection_error_px?: number | null;
  selected_camera_center?: number[] | null;
  selected_distance_to_reference_m?: number | null;
  selected_estimate_source?: 'visual-pnp' | 'semantic-cuboid' | 'temporal-prior' | null;
  candidates: CameraLocalizationCandidateTrace[];
}
export interface CameraLocalizationHistoryResponse {
  camera_id: string;
  map_id?: string | null;
  reference?: {
    kind?: 'ground-truth-floor' | 'latest-positioned-registration';
    floor_position?: number[];
    camera_center?: number[];
    calibration_id?: string;
    created_at?: string | null;
    updated_at?: string | null;
    source: string;
  } | null;
  ground_truth_reference?: {
    kind: 'ground-truth-floor';
    floor_position: number[];
    created_at?: string | null;
    updated_at?: string | null;
    source: string;
  } | null;
  accepted_reference?: {
    kind: 'latest-positioned-registration';
    camera_center: number[];
    calibration_id: string;
    created_at?: string | null;
    source: string;
  } | null;
  distance_metric?: 'horizontal-floor' | '3d-to-latest-accepted';
  attempts: CameraLocalizationAttemptTrace[];
}
export interface RoomPlanReadinessResponse {
  camera_id: string;
  map_id: string | null;
  source: 'roomplan-lidar-3d' | null;
  dimension: '3d' | null;
  visual_landmarks_ready: boolean;
  ready: boolean;
}
export interface RoomPlanCalibrationTarget {
  index: number;
  x: number;
  y: number;
  z: number;
  state: 'pending' | 'active' | 'complete';
}
export interface RoomPlanCalibrationProposal {
  id?: string | null;
  camera_id: string;
  map_id: string;
  camera_to_world: number[][];
  confidence?: number | null;
  tracking_state?: string | null;
  source?: string | null;
}
export interface RoomPlanCalibrationSession {
  session_id: string;
  camera_id: string;
  map_id: string;
  status: 'waiting_for_person' | 'capture_requested' | 'solving' | 'review' | 'failed' | 'expired';
  current_target_index: number;
  capture_request_seq: number;
  captured_target_count: number;
  targets: RoomPlanCalibrationTarget[];
  proposal?: RoomPlanCalibrationProposal | null;
  error?: string | null;
  created_at: string;
  expires_at: string;
  raw_frames_persisted: false;
}
export interface VisionFrameResponse {
  data: Array<{
    label: string;
    confidence: number;
    bbox: number[];
    projection: { world_xyz?: number[] | null; uncertainty_m: number; zone: string; quality: string; room_zone?: { id?: string; label?: string } | null };
  }>;
  detector_version: string;
  observations: Array<{ observation_id: string; event_id: string; object_id: string; zone?: string | null }>;
  frames_persisted: false;
}
export interface StartMapGenerationInput { room_id?: string | null; room_label?: string | null; orientation?: string; resolution_width: number; resolution_height: number; }
export interface MapGenerationStartResponse { job_id: string; status: MapGenerationStatus; }
export interface MapGenerationResponse {
  id?: string;
  job_id: string;
  home_id?: string;
  camera_id?: string;
  room_id?: string | null;
  room_label?: string;
  orientation?: string;
  status: MapGenerationStatus;
  progress: number;
  frame_count?: number;
  resolution_width?: number;
  resolution_height?: number;
  map_id?: string;
  source?: MapSource;
  dimension?: MapDimension;
  metric_scale_known?: boolean;
  metrics?: Record<string, number>;
  error_code?: string | null;
  error_message?: string | null;
  error?: string;
  geometry_status?: GeometryStatus;
  model_version?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
}
interface ObjectResponse { data: LastSeenObject[]; }
interface CameraResponse { data: Device[]; }

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rawPoint(value: unknown): { x: number; y: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = finiteNumber(value[0]);
    const y = finiteNumber(value[1]);
    return x === null || y === null ? null : { x, y };
  }
  if (!isRecord(value)) return null;
  const x = finiteNumber(value.x ?? value.u ?? value.normalized_x);
  const y = finiteNumber(value.y ?? value.v ?? value.normalized_y);
  return x === null || y === null ? null : { x, y };
}

function normalizeMapScale(value: unknown): MapScale | undefined {
  if (!isRecord(value)) return undefined;
  const metersPerNormalizedUnit = finiteNumber(value.meters_per_normalized_unit ?? value.metersPerNormalizedUnit);
  const referenceLengthM = finiteNumber(value.reference_length_m ?? value.referenceLengthM);
  const referenceLabel = value.reference_label ?? value.referenceLabel;
  if (metersPerNormalizedUnit === null || metersPerNormalizedUnit <= 0 || referenceLengthM === null || referenceLengthM <= 0 || typeof referenceLabel !== 'string' || !referenceLabel.trim()) return undefined;
  const rawPoints = isRecord(value.reference_points) ? value.reference_points : isRecord(value.referencePoints) ? value.referencePoints : undefined;
  const start = rawPoints ? rawPoint(rawPoints.start) : null;
  const end = rawPoints ? rawPoint(rawPoints.end) : null;
  return {
    status: 'measured_reference',
    method: 'caregiver_reference',
    metersPerNormalizedUnit,
    referenceLengthM,
    referenceLabel: referenceLabel.trim(),
    ...(start && end ? { referencePoints: { start, end } } : {}),
    ...(typeof value.measured_at === 'string' ? { measuredAt: value.measured_at } : typeof value.measuredAt === 'string' ? { measuredAt: value.measuredAt } : {}),
  };
}

function rawSize(value: unknown): { x: number; y: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = finiteNumber(value[0]);
    const y = finiteNumber(value[1]);
    return x === null || y === null ? null : { x, y };
  }
  if (!isRecord(value)) return null;
  const x = finiteNumber(value.x ?? value.width);
  const y = finiteNumber(value.y ?? value.height);
  return x === null || y === null ? null : { x, y };
}

function geometryScale(rawGeometry: RawRecord, point: { x: number; y: number }, resolutionWidth?: number, resolutionHeight?: number): Point2D {
  const coordinateSpace = typeof rawGeometry.coordinate_space === 'string' ? rawGeometry.coordinate_space : '';
  if (coordinateSpace === 'normalized' || (point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) {
    return { x: point.x * 100, y: point.y * 100 };
  }
  if (coordinateSpace === 'image' && resolutionWidth && resolutionHeight) {
    return { x: (point.x / resolutionWidth) * 100, y: (point.y / resolutionHeight) * 100 };
  }
  return point;
}

function geometrySizeScale(rawGeometry: RawRecord, size: { x: number; y: number }, resolutionWidth?: number, resolutionHeight?: number): Point2D {
  const coordinateSpace = typeof rawGeometry.coordinate_space === 'string' ? rawGeometry.coordinate_space : '';
  if (coordinateSpace === 'normalized' || (size.x >= 0 && size.x <= 1 && size.y >= 0 && size.y <= 1)) {
    return { x: size.x * 100, y: size.y * 100 };
  }
  if (coordinateSpace === 'image' && resolutionWidth && resolutionHeight) {
    return { x: (size.x / resolutionWidth) * 100, y: (size.y / resolutionHeight) * 100 };
  }
  return size;
}

function rawPoints(value: unknown, rawGeometry: RawRecord, resolutionWidth?: number, resolutionHeight?: number): Point2D[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    const parsed = rawPoint(point);
    return parsed ? [geometryScale(rawGeometry, parsed, resolutionWidth, resolutionHeight)] : [];
  });
}

function boundsForPoints(points: Point2D[]): Pick<Zone, 'x' | 'y' | 'width' | 'height'> | null {
  if (points.length < 3) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function normalizedGeometryPoint(value: unknown): { x: number; y: number; z: number } | null {
  if (Array.isArray(value) && value.length >= 3) {
    const x = finiteNumber(value[0]);
    const y = finiteNumber(value[1]);
    const z = finiteNumber(value[2]);
    return x === null || y === null || z === null ? null : { x, y, z };
  }
  if (!isRecord(value)) return null;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const z = finiteNumber(value.z);
  return x === null || y === null || z === null ? null : { x, y, z };
}

function normalizeThreeDimensionalList(value: unknown): Array<{ x: number; y: number; z: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    const parsed = normalizedGeometryPoint(point);
    return parsed ? [parsed] : [];
  });
}

function normalizeFaces(value: unknown): number[] | number[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.every((face) => typeof face === 'number')) return value as number[];
  const faces = value.filter((face): face is number[] => Array.isArray(face) && face.every((index) => typeof index === 'number'));
  return faces.length ? faces : undefined;
}

export function normalizeZones(zones: Array<Partial<Zone> & { polygon?: unknown }>): Scene['zones'] {
  return zones.flatMap((zone, index) => {
    const id = zone.id ?? `zone-${index + 1}`;
    const label = zone.name ?? id.replace(/[-_]+/g, ' ');
    const polygon = Array.isArray(zone.polygon) ? rawPoints(zone.polygon, {}) : [];
    const explicitBounds = [zone.x, zone.y, zone.width, zone.height].every((value) => finiteNumber(value) !== null);
    const bounds = polygon.length >= 3 ? boundsForPoints(polygon) : explicitBounds
      ? { x: zone.x as number, y: zone.y as number, width: zone.width as number, height: zone.height as number }
      : null;
    if (!bounds) return [];
    return [{ id, name: label, ...bounds, ...(polygon.length >= 3 ? { polygon } : {}), ...(finiteNumber(zone.confidence) !== null ? { confidence: zone.confidence } : {}) }];
  });
}

export function normalizeGeometry(raw: unknown, resolutionWidth?: number, resolutionHeight?: number): RoomGeometry | undefined {
  if (!isRecord(raw)) return undefined;
  const polygonSource = raw.polygons ?? raw.rooms ?? raw.zones;
  const polygons: PolygonGeometry[] = Array.isArray(polygonSource)
    ? polygonSource.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const points = rawPoints(item.points ?? item.polygon, raw, resolutionWidth, resolutionHeight);
      if (points.length < 3) return [];
      const confidence = finiteNumber(item.confidence);
      return [{ id: typeof item.id === 'string' ? item.id : `polygon-${index + 1}`, label: typeof (item.label ?? item.name) === 'string' ? String(item.label ?? item.name) : undefined, points, ...(confidence === null ? {} : { confidence }) }];
    })
    : [];
  const wallSource = raw.walls;
  const walls: WallGeometry[] = Array.isArray(wallSource)
    ? wallSource.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const explicitPoints = rawPoints(item.points, raw, resolutionWidth, resolutionHeight);
      const start2d = rawPoint(item.start);
      const end2d = rawPoint(item.end);
      const start = normalizedGeometryPoint(item.start);
      const end = normalizedGeometryPoint(item.end);
      const points = explicitPoints.length >= 2
        ? explicitPoints
        : start2d && end2d && !start && !end
          ? [geometryScale(raw, start2d, resolutionWidth, resolutionHeight), geometryScale(raw, end2d, resolutionWidth, resolutionHeight)]
          : [];
      if (points.length < 2 && !(start && end)) return [];
      const confidence = finiteNumber(item.confidence);
      return [{ id: typeof item.id === 'string' ? item.id : `wall-${index + 1}`, points, ...(start ? { start } : {}), ...(end ? { end } : {}), ...(finiteNumber(item.height) === null ? {} : { height: item.height as number }), ...(confidence === null ? {} : { confidence }) }];
    })
    : [];
  const furniture: FurnitureGeometry[] = Array.isArray(raw.furniture)
    ? raw.furniture.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const center = rawPoint(item.center ?? item.position);
      const size = rawSize(item.size ?? item.dimensions);
      if (!center || !size || size.x <= 0 || size.y <= 0) return [];
      const confidence = finiteNumber(item.confidence);
      const rotation = finiteNumber(item.rotation_degrees ?? item.rotationDegrees);
      return [{
        id: typeof item.id === 'string' ? item.id : `furniture-${index + 1}`,
        label: typeof (item.label ?? item.name) === 'string' ? String(item.label ?? item.name) : 'Fixture',
        center: geometryScale(raw, center, resolutionWidth, resolutionHeight),
        size: geometrySizeScale(raw, size, resolutionWidth, resolutionHeight),
        ...(rotation === null ? {} : { rotationDegrees: rotation }),
        ...(confidence === null ? {} : { confidence }),
      }];
    })
    : [];
  const openingSource = Array.isArray(raw.openings)
    ? raw.openings
    : [
      ...(Array.isArray(raw.doors) ? raw.doors.map((item) => ({ ...(isRecord(item) ? item : {}), kind: 'door' })) : []),
      ...(Array.isArray(raw.windows) ? raw.windows.map((item) => ({ ...(isRecord(item) ? item : {}), kind: 'window' })) : []),
    ];
  const openings: OpeningGeometry[] = openingSource.flatMap((item, index) => {
    if (!isRecord(item) || (item.kind !== 'door' && item.kind !== 'window')) return [];
    const start = rawPoint(item.start);
    const end = rawPoint(item.end);
    if (!start || !end) return [];
    const confidence = finiteNumber(item.confidence);
    return [{
      id: typeof item.id === 'string' ? item.id : `opening-${index + 1}`,
      kind: item.kind,
      start: geometryScale(raw, start, resolutionWidth, resolutionHeight),
      end: geometryScale(raw, end, resolutionWidth, resolutionHeight),
      ...(confidence === null ? {} : { confidence }),
    }];
  });
  const surfaces = Array.isArray(raw.surfaces)
    ? raw.surfaces.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const vertices = normalizeThreeDimensionalList(item.vertices);
      if (vertices.length < 3) return [];
      const confidence = finiteNumber(item.confidence);
      return [{ id: typeof item.id === 'string' ? item.id : `surface-${index + 1}`, kind: typeof item.kind === 'string' ? item.kind : undefined, vertices, faces: normalizeFaces(item.faces), ...(confidence === null ? {} : { confidence }) }];
    })
    : [];
  const mesh = isRecord(raw.mesh)
    ? (() => {
      const vertices = normalizeThreeDimensionalList(raw.mesh.vertices);
      const faces = normalizeFaces(raw.mesh.faces) ?? [];
      return vertices.length >= 3 && faces.length ? { vertices, faces } : undefined;
    })()
    : undefined;
  const objects = Array.isArray(raw.objects)
    ? raw.objects.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const position = normalizedGeometryPoint(item.position ?? item.center);
      const dimensions = normalizedGeometryPoint(item.dimensions ?? item.size);
      if (!position || !dimensions) return [];
      return [{ id: typeof item.id === 'string' ? item.id : `object-${index + 1}`, label: typeof item.label === 'string' ? item.label : typeof item.name === 'string' ? item.name : undefined, position, dimensions, ...(finiteNumber(item.confidence) === null ? {} : { confidence: item.confidence as number }) }];
    })
    : undefined;
  const roomZoneSource = raw.room_zones ?? raw.roomZones;
  const roomZones = Array.isArray(roomZoneSource)
    ? roomZoneSource.flatMap((item, index) => {
      if (!isRecord(item) || !Array.isArray(item.polygon)) return [];
      const polygon = item.polygon.flatMap((point) => {
        if (!isRecord(point)) return [];
        const x = finiteNumber(point.x);
        const z = finiteNumber(point.z);
        return x === null || z === null ? [] : [{ x, z }];
      });
      const floorY = finiteNumber(item.floor_y ?? item.floorY);
      if (polygon.length < 3 || floorY === null) return [];
      const confidence = finiteNumber(item.confidence);
      const story = finiteNumber(item.story);
      return [{
        id: typeof item.id === 'string' ? item.id : `room-zone-${index + 1}`,
        label: typeof item.label === 'string' ? item.label : `Room ${index + 1}`,
        polygon,
        floorY,
        ...(story === null ? {} : { story }),
        ...(confidence === null ? {} : { confidence }),
      }];
    })
    : [];
  if (!polygons.length && !walls.length && !surfaces.length && !mesh && !objects?.length && !furniture.length && !openings.length && !roomZones.length) return undefined;
  return { coordinateSpace: typeof raw.coordinate_space === 'string' ? raw.coordinate_space : undefined, polygons, walls, ...(surfaces.length ? { surfaces } : {}), ...(mesh ? { mesh } : {}), ...(objects?.length ? { objects } : {}), ...(furniture.length ? { furniture } : {}), ...(openings.length ? { openings } : {}), ...(roomZones.length ? { roomZones } : {}) };
}

function inferSource(source: MapSource | undefined, coordinateFrame?: string | null): MapSource {
  if (source) return source;
  return coordinateFrame === 'camera-room-2d' ? 'camera-cv-2d' : 'legacy-2d';
}

function inferDimension(dimension: MapDimension | undefined, source: MapSource): MapDimension {
  return dimension ?? (source === 'roomplan-lidar-3d' || source === 'arkit-video-3d' ? '3d' : '2d');
}

function normalizeCameraPose(value: unknown): CameraPose | undefined {
  if (!isRecord(value)) return undefined;
  const rawPosition = isRecord(value.position) ? value.position : undefined;
  const position = rawPosition && finiteNumber(rawPosition.z) !== null ? undefined : rawPoint(value.position);
  const position3d = normalizedGeometryPoint(value.position3d ?? (rawPosition && finiteNumber(rawPosition.z) !== null ? rawPosition : undefined));
  if (!position && !position3d) return undefined;
  return {
    ...(position ? { position } : {}),
    ...(position3d ? { position3d } : {}),
    ...(finiteNumber(value.heading_degrees ?? value.headingDegrees) === null ? {} : { headingDegrees: (value.heading_degrees ?? value.headingDegrees) as number }),
    ...(finiteNumber(value.fov_degrees ?? value.fovDegrees) === null ? {} : { fovDegrees: (value.fov_degrees ?? value.fovDegrees) as number }),
    ...(finiteNumber(value.confidence) === null ? {} : { confidence: value.confidence as number }),
  };
}

function normalizeCameraRegistration(value: unknown): CameraRegistration | undefined {
  if (!isRecord(value) || !['positioned', 'needs_rescan', 'unavailable'].includes(String(value.status))) return undefined;
  const rawMatrix = value.cameraToWorld ?? value.camera_to_world;
  const cameraToWorld = Array.isArray(rawMatrix)
    && rawMatrix.length === 4
    && rawMatrix.every((row) => Array.isArray(row) && row.length === 4 && row.every((component) => finiteNumber(component) !== null))
    ? rawMatrix as number[][]
    : undefined;
  return {
    status: value.status as CameraRegistration['status'],
    cameraId: typeof (value.cameraId ?? value.camera_id) === 'string' ? String(value.cameraId ?? value.camera_id) : null,
    cameraName: typeof (value.cameraName ?? value.camera_name) === 'string' ? String(value.cameraName ?? value.camera_name) : null,
    roomId: typeof (value.roomId ?? value.room_id) === 'string' ? String(value.roomId ?? value.room_id) : null,
    mapId: typeof (value.mapId ?? value.map_id) === 'string' ? String(value.mapId ?? value.map_id) : null,
    coordinateFrame: typeof (value.coordinateFrame ?? value.coordinate_frame) === 'string' ? String(value.coordinateFrame ?? value.coordinate_frame) : 'roomplan-local',
    cameraToWorld: cameraToWorld ?? null,
    confidence: finiteNumber(value.confidence),
    trackingState: typeof (value.trackingState ?? value.tracking_state) === 'string' ? String(value.trackingState ?? value.tracking_state) : null,
    source: typeof value.source === 'string' ? value.source : 'visual-roomplan-registration',
    ...(isRecord(value.intrinsics) ? { intrinsics: value.intrinsics } : {}),
    ...(isRecord(value.metrics) ? { metrics: value.metrics } : {}),
  };
}

function zonesFromGeometry(geometry: RoomGeometry | undefined): Zone[] {
  return geometry?.polygons.flatMap((polygon) => {
    const bounds = boundsForPoints(polygon.points);
    if (!bounds) return [];
    return [{
      id: polygon.id,
      name: polygon.label ?? polygon.id,
      ...bounds,
      polygon: polygon.points,
      ...(polygon.confidence === undefined ? {} : { confidence: polygon.confidence }),
    }];
  }) ?? [];
}

function sceneFromResponse(result: SceneResponse, geometryRaw?: unknown, resolutionWidth?: number, resolutionHeight?: number): Scene {
  const source = inferSource(result.source, result.coordinateFrame);
  const geometry = normalizeGeometry(geometryRaw ?? result.geometry, resolutionWidth, resolutionHeight);
  const geometryZones = zonesFromGeometry(geometry);
  const zones = normalizeZones(result.zones ?? []).length ? normalizeZones(result.zones ?? []) : geometryZones;
  const scale = normalizeMapScale(result.scale);
  const cameraRegistration = normalizeCameraRegistration(result.cameraRegistration);
  const cameraRegistrations = Array.isArray(result.cameraRegistrations)
    ? result.cameraRegistrations.flatMap((item) => {
      const registration = normalizeCameraRegistration(item);
      return registration ? [registration] : [];
    })
    : [];
  return {
    sceneId: result.sceneId ?? 'scene-empty',
    version: result.version,
    zones,
    mapId: result.mapId,
    coordinateFrame: result.coordinateFrame,
    dimension: inferDimension(result.dimension, source),
    source,
    confidence: result.confidence,
    metricScaleKnown: result.metricScaleKnown ?? (source === 'roomplan-lidar-3d' || source === 'arkit-video-3d'),
    ...(scale ? { scale } : {}),
    ...(geometry ? { geometry, walls: geometry.walls } : {}),
    ...(normalizeCameraPose(result.camera) ? { camera: normalizeCameraPose(result.camera) } : {}),
    ...(cameraRegistration ? { cameraRegistration } : {}),
    ...(cameraRegistrations.length ? { cameraRegistrations } : {}),
    ...(result.geometryStatus ? { geometryStatus: result.geometryStatus } : {}),
    ...(result.modelVersion ? { modelVersion: result.modelVersion } : {}),
  };
}

export function sceneFromMapResponse(map: MapResponse, baseScene?: Scene): Scene {
  const source = inferSource(map.source, map.coordinate_frame);
  const geometry = normalizeGeometry(map.map_data?.geometry ?? map.map_data);
  const geometryStatus = map.geometry_status ?? baseScene?.geometryStatus;
  const modelVersion = map.model_version ?? baseScene?.modelVersion;
  const scale = normalizeMapScale(map.scale ?? map.metadata?.scale ?? (isRecord(map.map_data) ? map.map_data.scale : undefined));
  const geometryZones = zonesFromGeometry(geometry);
  return {
    ...(baseScene ?? { sceneId: map.id, zones: [], version: map.revision }),
    sceneId: baseScene?.sceneId ?? map.id,
    version: map.revision,
    mapId: map.id,
    coordinateFrame: map.coordinate_frame,
    dimension: inferDimension(map.dimension, source),
    source,
    confidence: baseScene?.confidence ?? map.confidence ?? null,
    metricScaleKnown: map.dimension === '3d' && (source === 'roomplan-lidar-3d' || source === 'arkit-video-3d') ? true : baseScene?.metricScaleKnown ?? false,
    ...(scale ? { scale } : {}),
    ...(geometry ? { geometry, walls: geometry.walls } : {}),
    zones: geometryZones.length ? geometryZones : baseScene?.zones ?? [],
    ...(geometryStatus ? { geometryStatus } : {}),
    ...(modelVersion ? { modelVersion } : {}),
  };
}
export interface FamilyMember { id: string; display_name: string; email?: string | null; role: 'admin' | 'resident' | 'caregiver'; created_at: string; representation_status?: string; synthetic_demo?: boolean; }
export type EditableFamilyRole = Exclude<FamilyMember['role'], 'admin'>;
export interface FamilyMemberMutationResponse { data: FamilyMember; invalidated_sessions: number; }
export interface CareRecipient { id: string; display_name: string; relationship?: string | null; room_label?: string | null; created_at: string; }
export interface CareRecipientCreateInput { display_name: string; relationship?: string | null; room_label?: string | null; }
export type CareRecipientUpdateInput = Partial<CareRecipientCreateInput>;
export interface MedicationReminder { plan_id: string; name: string; dose: string; instructions: string; schedule_rule: string; scheduled_for: string; status: 'pending' | 'taken' | 'skipped' | 'missed'; note: string; updated_at?: string | null; assigned_caregiver_id?: string | null; assigned_caregiver_name?: string | null; }
export type MedicationCheckInStatus = 'taken' | 'skipped' | 'missed' | 'pending';
export interface FamilyInviteResponse { id: string; code: string; role: string; expires_in_seconds: number; synthetic_demo?: boolean; }
export interface MedicationPlan { id: string; subject_user_id: string; name: string; dose: string; schedule: string; instructions: string; active: boolean; version: number; assigned_caregiver_id?: string | null; }

const token = () => sessionStorage.getItem('one_access_token');
const homeId = () => sessionStorage.getItem('one_home_id') ?? 'current';
export const accessToken = token;
const cameraReconnectKey = (cameraId: string) => `one_camera_reconnect:${cameraId}`;

export function saveCameraReconnect(cameraId: string, reconnectToken: string): void {
  localStorage.setItem(cameraReconnectKey(cameraId), reconnectToken);
}

export function getCameraReconnect(cameraId: string): string | null {
  return localStorage.getItem(cameraReconnectKey(cameraId));
}

export function cameraReconnectUrl(cameraId: string, reconnectToken: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/camera/${encodeURIComponent(cameraId)}#key=${encodeURIComponent(reconnectToken)}`;
}

/** Remove every browser credential used by the ONE session. */
export function clearSession(): void {
  const home = sessionStorage.getItem('one_home_id');
  const user = sessionStorage.getItem('one_user_id');
  if (home && user) localStorage.removeItem(`one_onboarding_complete:${home}:${user}`);
  sessionStorage.clear();
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (init?.auth !== false && token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    if (response.status === 401 && init?.auth !== false && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('one:session-expired'));
    }
    throw new Error(`API_${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

async function requestBinary(path: string, init?: RequestOptions): Promise<ArrayBuffer> {
  const headers = new Headers(init?.headers);
  if (init?.auth !== false && token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    if (response.status === 401 && init?.auth !== false && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('one:session-expired'));
    }
    throw new Error(`API_${response.status}`);
  }
  return response.arrayBuffer();
}

export function mapBackendEvent(event: BackendEvent): HomeEvent {
  const isObject = event.event_type === 'object_observed';
  return { id: event.id, type: isObject ? 'object.last_seen' : 'presence.changed', title: isObject ? 'Object observed' : 'Meaningful moment', detail: event.explanation || 'An observation is available for review.', occurredAt: event.last_seen_at ?? event.first_seen_at ?? new Date().toISOString(), cameraId: event.source?.camera_id, cameraName: event.source?.camera_name, roomName: event.source?.room_name, objectId: event.source?.object_id ?? undefined, confidence: event.confidence, tone: isObject ? 'blue' : 'green' };
}

export const api = {
  getSession: async (): Promise<Session> => {
    if (!demoMode) return request<MeResponse>('/me');
    const active = demoCareSpaces.find((space) => space.id === demoActiveCareSpaceId) ?? demoCareSpaces[0];
    return {
      ...demoSession,
      actor: { ...demoSession.actor, role: active.role },
      home: { id: active.id, name: active.name, residentName: active.residentName, careSetting: active.careSetting, supportFocus: active.supportFocus },
    };
  },
  getCareSpaces: async (): Promise<CareSpaceSummary[]> => demoMode
    ? demoCareSpaces.map((space) => ({ ...space, active: space.id === demoActiveCareSpaceId }))
    : (await request<{ data: CareSpaceSummary[] }>('/account/homes')).data,
  activateCareSpace: async (careSpaceId: string): Promise<CareSpaceSession> => {
    const result: CareSpaceSession = demoMode
      ? { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: careSpaceId, user_id: demoSession.actor.id, role: demoCareSpaces.find((space) => space.id === careSpaceId)?.role ?? 'caregiver' }
      : await request<CareSpaceSession>(`/account/homes/${encodeURIComponent(careSpaceId)}/activate`, { method: 'POST' });
    if (demoMode) demoActiveCareSpaceId = careSpaceId;
    sessionStorage.setItem('one_access_token', result.access_token);
    sessionStorage.setItem('one_home_id', result.home_id);
    sessionStorage.setItem('one_user_id', result.user_id);
    return result;
  },
  createCareSpace: async (input: CareSpaceCreateInput): Promise<CareSpaceSession> => {
    let result: CareSpaceSession;
    if (demoMode) {
      const id = `home-demo-${demoCareSpaces.length + 1}`;
      demoCareSpaces.push({ id, name: input.name.trim(), residentName: 'Resident', careSetting: input.careSetting, supportFocus: input.supportFocus, role: 'admin', active: false });
      result = { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: id, user_id: demoSession.actor.id, role: 'admin' };
      demoActiveCareSpaceId = id;
    } else {
      result = await request<CareSpaceSession>('/account/homes', { method: 'POST', body: JSON.stringify({ name: input.name, care_setting: input.careSetting, support_focus: input.supportFocus }) });
    }
    sessionStorage.setItem('one_access_token', result.access_token);
    sessionStorage.setItem('one_home_id', result.home_id);
    sessionStorage.setItem('one_user_id', result.user_id);
    return result;
  },
  getScene: async (): Promise<Scene> => {
    if (demoMode) return demoScene;
    const result = await request<SceneResponse>(`/homes/${homeId()}/scene`);
    return sceneFromResponse(result, result.geometry);
  },
  getRoomPlanPlacementPreview: async (cameraId: string): Promise<Scene> => {
    if (demoMode) return demoScene;
    const result = await request<SceneResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/roomplan-placement-preview`);
    return sceneFromResponse(result, result.geometry);
  },
  getCurrentMap: async (): Promise<MapResponse | null> => {
    if (demoMode) return {
      id: demoScene.sceneId,
      revision: demoScene.version,
      coordinate_frame: 'camera-relative-image',
      source: 'camera-cv-2d',
      dimension: '2d',
      metadata: { demo: true },
      scale: demoMapScale,
      map_data: { geometry: demoScene.geometry },
    };
    try { return await request<MapResponse>(`/homes/${homeId()}/maps/current`); } catch (error) { if (error instanceof Error && error.message === 'API_404') return null; throw error; }
  },
  getRoomPlanUSDZ: async (mapId: string): Promise<ArrayBuffer> => {
    if (demoMode) throw new Error('API_404');
    return requestBinary(`/homes/${homeId()}/maps/${encodeURIComponent(mapId)}/usdz`);
  },
  getRoomPlanPlacementPreviewUSDZ: async (cameraId: string): Promise<ArrayBuffer> => {
    if (demoMode) throw new Error('API_404');
    return requestBinary(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/roomplan-placement-preview/usdz`);
  },
  getObjects: async (): Promise<LastSeenObject[]> => demoMode ? demoObjects : (await request<ObjectResponse>(`/homes/${homeId()}/objects/last-seen`)).data,
  getEvents: async (): Promise<HomeEvent[]> => demoMode ? demoEvents : request<{ data: BackendEvent[] }>(`/homes/${homeId()}/events?limit=50`).then((r) => r.data.map(mapBackendEvent)),
  getCaregiverSummaries: async (): Promise<CaregiverSummary[]> => {
    if (demoMode) return [
      { id: 'demo-summary-1', status: 'stable', trend: 'stable', explanation: 'The latest check-in is within the recent household pattern.', limitations: 'Demo observation; not a diagnosis.', evidenceIds: ['evt-checkin'], createdAt: new Date().toISOString() },
      { id: 'demo-summary-2', status: 'unknown', trend: 'unknown', explanation: 'There was not enough information to establish a trend.', limitations: 'Demo observation; not a diagnosis.', evidenceIds: [], createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString() },
    ];
    const response = await request<{ data: BackendCaregiverSummary[] }>(`/homes/${homeId()}/caregiver-summary`);
    return response.data.map((item) => {
      let evidenceIds: string[] = [];
      try {
        const parsed: unknown = JSON.parse(item.evidence_json || '[]');
        if (Array.isArray(parsed)) evidenceIds = parsed.filter((id): id is string => typeof id === 'string');
      } catch { /* Malformed evidence is omitted, while the summary remains readable. */ }
      return { id: item.id, status: item.status === 'stable' || item.status === 'attention' ? item.status : 'unknown', trend: item.trend, explanation: item.explanation, limitations: item.limitations, evidenceIds, createdAt: item.created_at };
    });
  },
  getCheckInQuestions: async (): Promise<CheckInQuestion[]> => {
    if (demoMode) {
      const today = new Date();
      const current = [
        { id: 'demo-q-1', summaryId: 'demo-summary-1', question: 'How are you feeling today?', answer: 'Answered', responseTimeMs: 12_000, baselineMs: 9_000, pulseBpm: 74, askedAt: new Date(today.setHours(8, 23, 0, 0)).toISOString() },
        { id: 'demo-q-2', summaryId: 'demo-summary-1', question: 'Did you have breakfast?', answer: 'Answered', responseTimeMs: 6_000, baselineMs: 9_000, pulseBpm: 74, askedAt: new Date(today.setHours(8, 24, 0, 0)).toISOString() },
        { id: 'demo-q-3', summaryId: 'demo-summary-1', question: 'Where are your glasses?', answer: 'Answered', responseTimeMs: 12_000, baselineMs: 9_000, pulseBpm: 74, askedAt: new Date(today.setHours(8, 25, 0, 0)).toISOString() },
        { id: 'demo-q-4', summaryId: 'demo-summary-1', question: 'Would you like some water?', answer: 'Answered', responseTimeMs: 12_000, baselineMs: 9_000, pulseBpm: 74, askedAt: new Date(today.setHours(8, 26, 0, 0)).toISOString() },
      ];
      const history = [11_000, 9_000, 14_000, 10_000, 12_000, 9_000].map((responseTimeMs, index) => {
        const askedAt = new Date(); askedAt.setDate(askedAt.getDate() - (6 - index)); askedAt.setHours(8, 23, 0, 0);
        return { id: `demo-q-history-${index}`, summaryId: 'demo-summary-2', question: 'How are you feeling today?', answer: 'Answered', responseTimeMs, baselineMs: 9_000, pulseBpm: 74, askedAt: askedAt.toISOString() };
      });
      return [...demoDailyQuestions, ...current, ...history];
    }
    const response = await request<{ data: BackendCheckInQuestion[] }>(`/homes/${homeId()}/check-ins/questions?limit=500`);
    return response.data.map((item) => ({ id: item.id, summaryId: item.summary_id, question: item.question, answer: item.answer, responseTimeMs: item.response_time_ms, baselineMs: item.baseline_ms, pulseBpm: item.pulse_bpm, askedAt: item.asked_at }));
  },
  submitDailyCheckIn: async (input: DailyCheckInInput): Promise<{ id: string; degraded: boolean }> => {
    if (demoMode) {
      const id = `demo-daily-${Date.now()}`;
      const askedAt = new Date().toISOString();
      demoDailyQuestions.unshift(...input.questions.map((item, index) => ({ id: `${id}-${index}`, summaryId: id, question: item.question, answer: item.answer, responseTimeMs: item.responseTimeMs, baselineMs: item.baselineMs, pulseBpm: item.pulseBpm, askedAt })));
      return { id, degraded: true };
    }
    return request<{ id: string; degraded: boolean }>(`/homes/${homeId()}/check-ins`, { method: 'POST', body: JSON.stringify({ subject_user_id: input.subjectUserId ?? null, transcript: '', questions: input.questions.map((item) => ({ question: item.question, answer: item.answer, response_time_ms: item.responseTimeMs, baseline_ms: item.baselineMs, pulse_bpm: item.pulseBpm })) }) });
  },
  getCameras: async (): Promise<Device[]> => {
    if (demoMode) return [demoDevice];
    return (await request<CameraResponse>(`/homes/${homeId()}/cameras`)).data;
  },
  getDevice: async (): Promise<Device | null> => (await api.getCameras())[0] ?? null,
  updateCamera: async (cameraId: string, input: { name?: string; room_id?: string | null; metadata?: Record<string, unknown> }) => {
    if (demoMode) return { status: 'saved' };
    return request(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  deleteCamera: async (cameraId: string): Promise<{ id: string; status: string; revoked_sessions?: number }> => {
    if (demoMode) return { id: cameraId, status: 'deleted', revoked_sessions: 0 };
    return request(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}`, { method: 'DELETE' });
  },
  measureMapScale: async (mapId: string, input: { start: Point2D; end: Point2D; length_m: number; label: string }): Promise<MapResponse> => {
    if (demoMode) {
      const distance = Math.hypot(input.end.x - input.start.x, input.end.y - input.start.y);
      demoMapScale = {
        status: 'measured_reference',
        method: 'caregiver_reference',
        metersPerNormalizedUnit: input.length_m / distance,
        referenceLengthM: input.length_m,
        referenceLabel: input.label,
        referencePoints: { start: input.start, end: input.end },
        measuredAt: new Date().toISOString(),
      };
      return { ...(await api.getCurrentMap())!, scale: demoMapScale };
    }
    return request<MapResponse>(`/homes/${homeId()}/maps/${encodeURIComponent(mapId)}/scale`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  startMapGeneration: async (cameraId: string, input: StartMapGenerationInput): Promise<MapGenerationStartResponse> => {
    if (demoMode) return { job_id: `job-${cameraId}`, status: 'collecting' };
    return request<MapGenerationStartResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/map-generation`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  submitMapGenerationFrames: async (cameraId: string, jobId: string, frames: MapGenerationFrame[]): Promise<void> => {
    if (demoMode) return;
    await request<unknown>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/map-generation/${encodeURIComponent(jobId)}/frames`, {
      method: 'POST',
      body: JSON.stringify({ frames }),
    });
  },
  localizeRoomPlanCamera: async (cameraId: string, frames: MapGenerationFrame[], fovDegrees = 60, reviewOnly = false, personAnchors: CameraLocalizationPersonAnchor[] = []): Promise<CameraLocalizationResponse> => {
    if (demoMode) return { id: `registration-${cameraId}`, status: 'positioned', camera_id: cameraId, map_id: demoScene.sceneId, coordinate_frame: 'roomplan-local', camera_to_world: [[1, 0, 0, 0], [0, 1, 0, 1.5], [0, 0, 1, 0], [0, 0, 0, 1]], confidence: 0.95, tracking_state: 'visual-pnp', source: 'visual-roomplan-registration', inlier_count: 32, match_count: 40, reprojection_error_px: 1.2, intrinsics_source: 'estimated-fov', review_required: reviewOnly };
    return request<CameraLocalizationResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/localize-roomplan`, {
      method: 'POST',
      body: JSON.stringify({ frames, fov_degrees: fovDegrees, review_only: reviewOnly, person_anchors: personAnchors }),
    });
  },
  registerRoomPlanCamera: async (input: { camera_id: string; map_id: string; camera_to_world: number[][]; confidence?: number | null; tracking_state?: 'normal' | 'limited' | 'unavailable' }): Promise<CameraLocalizationResponse> => {
    if (demoMode) return { id: `registration-${input.camera_id}`, status: 'positioned', camera_id: input.camera_id, map_id: input.map_id, coordinate_frame: 'roomplan-local', camera_to_world: input.camera_to_world, confidence: input.confidence ?? null, tracking_state: input.tracking_state ?? 'normal', source: 'auto-roomplan-registration', inlier_count: 0, match_count: 0, intrinsics_source: 'manual-review' };
    return request<CameraLocalizationResponse>(`/homes/${homeId()}/camera-registrations/roomplan`, {
      method: 'POST',
      body: JSON.stringify({
        camera_id: input.camera_id,
        map_id: input.map_id,
        camera_to_world: input.camera_to_world,
        confidence: input.confidence ?? null,
        tracking_state: input.tracking_state ?? 'normal',
      }),
    });
  },
  getCameraLocalizationHistory: async (cameraId: string): Promise<CameraLocalizationHistoryResponse> => {
    if (demoMode) return { camera_id: cameraId, map_id: null, reference: null, attempts: [] };
    return request<CameraLocalizationHistoryResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/localization-history?limit=40`);
  },
  setCameraLocalizationReference: async (cameraId: string, input: { x: number; z: number; source?: string }): Promise<void> => {
    if (demoMode) return;
    await request<unknown>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/localization-reference`, {
      method: 'PUT',
      body: JSON.stringify({ x: input.x, z: input.z, source: input.source ?? 'manual-floor-reference' }),
    });
  },
  getRoomPlanReadiness: async (cameraId: string): Promise<RoomPlanReadinessResponse> => {
    if (demoMode) return { camera_id: cameraId, map_id: null, source: null, dimension: null, visual_landmarks_ready: false, ready: false };
    return request<RoomPlanReadinessResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/roomplan-readiness`);
  },
  getRoomPlanCalibrationSession: async (cameraId: string): Promise<RoomPlanCalibrationSession | null> => {
    if (demoMode) return null;
    try {
      return await request<RoomPlanCalibrationSession>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/roomplan-calibration-session`);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_404') return null;
      throw error;
    }
  },
  submitRoomPlanCalibrationFrames: async (cameraId: string, targetIndex: number, frames: MapGenerationFrame[]): Promise<RoomPlanCalibrationSession> => {
    if (demoMode) throw new Error('API_404');
    return request<RoomPlanCalibrationSession>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/roomplan-calibration-session/frames`, {
      method: 'POST',
      body: JSON.stringify({ target_index: targetIndex, frames }),
    });
  },
  submitVisionFrame: async (cameraId: string, frame: MapGenerationFrame): Promise<VisionFrameResponse> => {
    if (demoMode) return { data: [], detector_version: 'demo', observations: [], frames_persisted: false };
    return request<VisionFrameResponse>(`/homes/${homeId()}/vision/frames`, {
      method: 'POST',
      body: JSON.stringify({ camera_id: cameraId, ...frame, candidate_labels: [] }),
    });
  },
  getMapGeneration: async (cameraId: string, jobId: string): Promise<MapGenerationResponse> => {
    if (demoMode) return { job_id: jobId, status: 'ready', progress: 100, map_id: demoScene.sceneId, geometry_status: 'ready', model_version: 'demo-camera-room-layout' };
    return request<MapGenerationResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/map-generation/${encodeURIComponent(jobId)}`);
  },
  getLatestMapGeneration: async (cameraId: string): Promise<MapGenerationResponse | null> => {
    if (demoMode) return { job_id: `job-${cameraId}`, status: 'ready', progress: 100, map_id: demoScene.sceneId, geometry_status: 'ready', model_version: 'demo-camera-room-layout' };
    try {
      return await request<MapGenerationResponse>(`/homes/${homeId()}/cameras/${encodeURIComponent(cameraId)}/map-generation`);
    } catch (error) {
      if (error instanceof Error && error.message === 'API_404') return null;
      throw error;
    }
  },
  startPairing: async (displayName: string, homeName = 'ONE Home', role: 'resident' | 'caregiver' = 'resident'): Promise<PairStartResponse> => demoMode ? { pairing_code: '482701', expires_in_seconds: 600, home_id: 'home-demo', user_id: 'user-demo', role } : request('/pairing/start', { method: 'POST', auth: false, body: JSON.stringify({ display_name: displayName, home_name: homeName, care_setting: 'home', support_focus: 'general', role } satisfies PairStartInput) }),
  createAccount: async (displayName: string, email: string, homeName: string): Promise<PairStartResponse> => {
    if (demoMode) return api.startPairing(displayName, homeName, 'caregiver');
    return request('/pairing/start', { method: 'POST', auth: false, body: JSON.stringify({ display_name: displayName, email: email || null, home_name: homeName || 'ONE Home', care_setting: 'home', support_focus: 'general', role: 'admin' } satisfies PairStartInput) });
  },
  requestEmailCode: async (purpose: 'create' | 'login', email: string, displayName?: string, homeName?: string, careSetting: 'home' | 'residence' = 'home', supportFocus: 'general' | 'mci' = 'general'): Promise<EmailChallenge> => demoMode ? { verification_id: 'email-demo', expires_in_seconds: 600, delivery: 'development_outbox', dev_code: '482701', email: email.trim().toLowerCase(), purpose, home_id: 'home-demo', user_id: 'user-demo', role: 'admin' } : request<EmailChallenge>('/auth/email/request', { method: 'POST', auth: false, body: JSON.stringify({ purpose, email, display_name: displayName || null, home_name: homeName || 'ONE Home', care_setting: careSetting, support_focus: supportFocus, role: 'admin' }) }),
  verifyEmailCode: async (email: string, code: string): Promise<EmailSession> => {
    const result = demoMode ? { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: 'home-demo', user_id: 'user-demo', role: 'admin', email } : await request<EmailSession>('/auth/email/verify', { method: 'POST', auth: false, body: JSON.stringify({ email, code }) });
    sessionStorage.setItem('one_access_token', result.access_token); sessionStorage.setItem('one_home_id', result.home_id); sessionStorage.setItem('one_user_id', result.user_id); return result;
  },
  acceptFamilyInvite: async (code: string, displayName: string, email = ''): Promise<InviteAcceptResponse> => {
    const result = demoMode ? { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: 'home-demo', user_id: 'invite-demo', role: 'caregiver' } : await request<InviteAcceptResponse>('/family/invites/accept', { method: 'POST', auth: false, body: JSON.stringify({ code, email: email || null, display_name: displayName || null }) });
    sessionStorage.setItem('one_access_token', result.access_token); sessionStorage.setItem('one_home_id', result.home_id); sessionStorage.setItem('one_user_id', result.user_id); return result;
  },
  startPublisherPairing: async (displayName: string, homeName = 'ONE Home'): Promise<PairStartResponse> => {
    if (demoMode) return api.startPairing(displayName, homeName, 'resident');
    if (!token() || homeId() === 'current') throw new Error('API_401');
    return request(`/homes/${homeId()}/pairing/start`, { method: 'POST', body: JSON.stringify({ label: displayName, expires_in_seconds: 600 }) });
  },
  getPairingStatus: async (pairingId: string): Promise<PairingStatus> => demoMode
    ? { pairing_id: pairingId, home_id: 'home-demo', status: 'connected', expires_at: new Date(Date.now() + 600_000).toISOString(), connected_at: new Date().toISOString(), device: { id: pairingId, label: 'Hallway phone', role: 'publisher' } }
    : request<PairingStatus>(`/homes/${homeId()}/pairing/${encodeURIComponent(pairingId)}/status`),
  completePairing: async (code: string): Promise<PairCompleteResponse> => {
    const result = demoMode
      ? { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: 'home-demo', user_id: 'user-demo', reconnect_token: 'demo-reconnect-token' }
      : await request<PairCompleteResponse>('/pairing/complete', { method: 'POST', auth: false, body: JSON.stringify({ code }) });
    sessionStorage.setItem('one_access_token', result.access_token);
    sessionStorage.setItem('one_home_id', result.home_id);
    sessionStorage.setItem('one_user_id', result.user_id);
    if (result.reconnect_token) saveCameraReconnect(result.user_id, result.reconnect_token);
    return result;
  },
  reconnectCamera: async (cameraId: string, reconnectToken: string): Promise<PairCompleteResponse> => {
    const result = demoMode
      ? { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: 'home-demo', user_id: cameraId }
      : await request<PairCompleteResponse>('/camera/reconnect', { method: 'POST', auth: false, body: JSON.stringify({ camera_id: cameraId, reconnect_token: reconnectToken }) });
    sessionStorage.setItem('one_access_token', result.access_token);
    sessionStorage.setItem('one_home_id', result.home_id);
    sessionStorage.setItem('one_user_id', result.user_id);
    saveCameraReconnect(cameraId, reconnectToken);
    return result;
  },
  createCameraReconnectLink: async (): Promise<{ camera_id: string; reconnect_token: string }> => {
    const result = demoMode
      ? { camera_id: sessionStorage.getItem('one_user_id') ?? 'device-demo', reconnect_token: 'demo-reconnect-token' }
      : await request<{ camera_id: string; reconnect_token: string }>('/camera/reconnect-link', { method: 'POST' });
    saveCameraReconnect(result.camera_id, result.reconnect_token);
    return result;
  },
  logout: async (): Promise<void> => {
    try {
      if (!demoMode && token()) await request('/sessions/current', { method: 'DELETE' });
    } finally {
      clearSession();
    }
  },
  createPairing: async (label: string) => { const response = await api.startPublisherPairing(label); return { pairing_id: response.pairing_id ?? response.user_id, code: response.code ?? response.pairing_code, expires_at: new Date(Date.now() + response.expires_in_seconds * 1000).toISOString() }; },
  getLiveKitToken: async (mode: 'auto' | 'publish' | 'subscribe' = 'auto'): Promise<LiveKitResponse> => demoMode ? { url: '', token: '', expires_in: 600, mode } : request(`/homes/${homeId()}/livekit/token`, { method: 'POST', body: JSON.stringify({ mode } satisfies LiveKitInput) }),
  giveConsent: async (purpose: string, granted: boolean) => demoMode ? { id: `consent-${purpose}`, granted } : request(`/homes/${homeId()}/consents`, { method: 'POST', body: JSON.stringify({ purpose, policy_version: '2026-09-01', granted }) }),
  pause: async () => demoMode ? { status: 'paused' } : request(`/homes/${homeId()}/consents`, { method: 'POST', body: JSON.stringify({ purpose: 'video_capture', policy_version: '2026-09-01', granted: false }) }),
  resume: async () => demoMode ? { status: 'resumed' } : request(`/homes/${homeId()}/consents`, { method: 'POST', body: JSON.stringify({ purpose: 'video_capture', policy_version: '2026-09-01', granted: true }) }),
  exportData: async () => demoMode ? { status: 'complete' } : request(`/homes/${homeId()}/privacy/export`, { method: 'POST' }),
  deleteData: async () => demoMode ? { status: 'queued' } : request(`/homes/${homeId()}/privacy/delete`, { method: 'POST' }),
  getCareRecipients: async (): Promise<CareRecipient[]> => {
    if (demoMode) return [...(demoCareRecipients[demoActiveCareSpaceId] ?? [])];
    return (await request<{ data: CareRecipient[] }>(`/homes/${homeId()}/care-recipients`)).data;
  },
  createCareRecipient: async (input: CareRecipientCreateInput): Promise<CareRecipient> => {
    if (!demoMode) return (await request<{ data: CareRecipient }>(`/homes/${homeId()}/care-recipients`, { method: 'POST', body: JSON.stringify(input) })).data;
    const recipients = demoCareRecipients[demoActiveCareSpaceId] ?? (demoCareRecipients[demoActiveCareSpaceId] = []);
    const recipient: CareRecipient = {
      id: `recipient-${demoActiveCareSpaceId}-${recipients.length + 1}`,
      display_name: input.display_name.trim(),
      relationship: input.relationship?.trim() || null,
      room_label: input.room_label?.trim() || null,
      created_at: new Date().toISOString(),
    };
    recipients.push(recipient);
    return recipient;
  },
  updateCareRecipient: async (recipientId: string, input: CareRecipientUpdateInput): Promise<CareRecipient> => {
    if (!demoMode) return (await request<{ data: CareRecipient }>(`/homes/${homeId()}/care-recipients/${encodeURIComponent(recipientId)}`, { method: 'PATCH', body: JSON.stringify(input) })).data;
    const recipients = demoCareRecipients[demoActiveCareSpaceId] ?? [];
    const index = recipients.findIndex((recipient) => recipient.id === recipientId);
    if (index < 0) throw new Error('API_404');
    const current = recipients[index];
    const updated: CareRecipient = {
      ...current,
      ...(input.display_name === undefined ? {} : { display_name: input.display_name.trim() }),
      ...(input.relationship === undefined ? {} : { relationship: input.relationship?.trim() || null }),
      ...(input.room_label === undefined ? {} : { room_label: input.room_label?.trim() || null }),
    };
    recipients[index] = updated;
    return updated;
  },
  deleteCareRecipient: async (recipientId: string): Promise<CareRecipient> => {
    if (!demoMode) return (await request<{ data: CareRecipient }>(`/homes/${homeId()}/care-recipients/${encodeURIComponent(recipientId)}`, { method: 'DELETE' })).data;
    const recipients = demoCareRecipients[demoActiveCareSpaceId] ?? [];
    const index = recipients.findIndex((recipient) => recipient.id === recipientId);
    if (index < 0) throw new Error('API_404');
    return recipients.splice(index, 1)[0];
  },
  getFamilyMembers: async (): Promise<FamilyMember[]> => demoMode ? [] : (await request<{ data: FamilyMember[] }>(`/homes/${homeId()}/family/members`)).data,
  createFamilyInvite: async (displayName: string, email: string, role: 'resident' | 'caregiver' = 'caregiver'): Promise<FamilyInviteResponse> => demoMode ? { id: 'invite-demo', code: '482701', role, expires_in_seconds: 86400, synthetic_demo: true } : request<FamilyInviteResponse>(`/homes/${homeId()}/family/invites`, { method: 'POST', body: JSON.stringify({ display_name: displayName, email: email || null, role, expires_in_seconds: 86400 }) }),
  updateFamilyMember: async (memberId: string, role: EditableFamilyRole): Promise<FamilyMemberMutationResponse> => demoMode ? { data: { id: memberId, display_name: 'Demo family member', role, created_at: new Date().toISOString(), synthetic_demo: true }, invalidated_sessions: 0 } : request<FamilyMemberMutationResponse>(`/homes/${homeId()}/family/members/${encodeURIComponent(memberId)}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeFamilyMember: async (memberId: string): Promise<FamilyMemberMutationResponse> => demoMode ? { data: { id: memberId, display_name: 'Demo family member', role: 'resident', created_at: new Date().toISOString(), synthetic_demo: true }, invalidated_sessions: 0 } : request<FamilyMemberMutationResponse>(`/homes/${homeId()}/family/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' }),
  getMedicationReminders: async (day = new Date().toISOString().slice(0, 10), subjectUserId?: string): Promise<MedicationReminder[]> => demoMode ? [] : (await request<{ data: MedicationReminder[] }>(`/homes/${homeId()}/medication-reminders?day=${encodeURIComponent(day)}${subjectUserId ? `&subject_user_id=${encodeURIComponent(subjectUserId)}` : ''}`)).data,
  getMedicationPlans: async (subjectUserId?: string, activeOnly = true): Promise<MedicationPlan[]> => demoMode ? [] : (await request<{ data: MedicationPlan[] }>(`/homes/${homeId()}/medication-plans?active_only=${activeOnly}${subjectUserId ? `&subject_user_id=${encodeURIComponent(subjectUserId)}` : ''}`)).data,
  createMedicationPlan: async (input: Omit<MedicationPlan, 'id' | 'active' | 'version'> & { active?: boolean }): Promise<MedicationPlan> => demoMode ? { ...input, id: 'plan-demo', active: input.active ?? true, version: 1 } : request<MedicationPlan>(`/homes/${homeId()}/medication-plans`, { method: 'POST', body: JSON.stringify(input) }),
  updateMedicationPlan: async (planId: string, input: Partial<Pick<MedicationPlan, 'name' | 'dose' | 'schedule' | 'instructions' | 'active' | 'assigned_caregiver_id'>> & { version?: number }): Promise<MedicationPlan> => demoMode ? { id: planId, subject_user_id: 'user-demo', name: input.name ?? 'Demo plan', dose: input.dose ?? '', schedule: input.schedule ?? '', instructions: input.instructions ?? '', active: input.active ?? true, version: (input.version ?? 1) + 1, assigned_caregiver_id: input.assigned_caregiver_id } : request<MedicationPlan>(`/homes/${homeId()}/medication-plans/${encodeURIComponent(planId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateMedicationCheckIn: async (planId: string, scheduledFor: string, status: MedicationCheckInStatus, note = ''): Promise<void> => {
    if (demoMode) return;
    await request(`/homes/${homeId()}/medication-plans/${encodeURIComponent(planId)}/check-ins`, { method: 'POST', body: JSON.stringify({ scheduled_for: scheduledFor, status, note }) });
  },
  askFamilyAssistant: async (message: string, subjectUserId?: string) => demoMode ? { degraded: true, data: { summary: 'Demo mode keeps the organizer local.', next_action: 'Connect a backend family consent to review live reminders.', evidence_ids: [], limitations: 'Administrative summary only; not medical advice.' } } : request(`/homes/${homeId()}/family-assistant`, { method: 'POST', body: JSON.stringify({ message, subject_user_id: subjectUserId ?? null }) }),
};

export type ApiClient = typeof api;
