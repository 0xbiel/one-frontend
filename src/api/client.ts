import type { Device, HomeEvent, LastSeenObject, Scene, Session } from '../models/domain';
import { demoDevice, demoEvents, demoObjects, demoScene, demoSession } from '../demo/data';
import type { paths } from './schema';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
// Live API is the safe default. Demo data must be explicitly enabled.
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

interface RequestOptions extends RequestInit { auth?: boolean; }
type JsonBody<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends { requestBody?: { content?: { 'application/json'?: infer Body } } } ? Body : never;
type PairStartInput = JsonBody<'/api/v1/pairing/start', 'post'>;
type LiveKitInput = JsonBody<'/api/v1/homes/{home_id}/livekit/token', 'post'>;
interface PairStartResponse { pairing_id?: string; pairing_code: string; code?: string; expires_in_seconds: number; home_id: string; user_id: string; role?: 'admin' | 'resident' | 'caregiver' | 'publisher' | string; }
interface PairCompleteResponse { access_token: string; token_type: string; expires_in: number; home_id: string; user_id: string; }
export interface EmailChallenge { verification_id: string; expires_in_seconds: number; delivery: string; dev_code?: string | null; email: string; purpose: 'create' | 'login'; home_id: string; user_id: string; role: string; }
export interface EmailSession extends PairCompleteResponse { role?: string; email?: string; }
interface InviteAcceptResponse extends PairCompleteResponse { role?: string; }
interface LiveKitResponse { url: string; token: string; expires_in: number; mode?: 'auto' | 'publish' | 'subscribe'; }
interface BackendEvent { id: string; event_type: string; status?: string; explanation?: string; confidence?: number; evidence_ids?: string; evidence_json?: string; first_seen_at?: string; last_seen_at?: string; }
interface MeResponse { actor: Session['actor']; home: Session['home']; device: Device | null; paused: boolean; }
interface SceneResponse { sceneId: string | null; version: number; zones: Scene['zones']; mapId?: string | null; coordinateFrame?: string | null; }
interface MapResponse { id: string; revision: number; coordinate_frame: string; room_id?: string | null; created_at?: string; map_data?: Record<string, unknown>; }
interface ObjectResponse { data: LastSeenObject[]; }
interface CameraResponse { data: Device[]; }
export interface FamilyMember { id: string; display_name: string; email?: string | null; role: 'admin' | 'resident' | 'caregiver'; created_at: string; representation_status?: string; synthetic_demo?: boolean; }
export interface MedicationReminder { plan_id: string; name: string; dose: string; instructions: string; schedule_rule: string; scheduled_for: string; status: 'pending' | 'taken' | 'skipped' | 'missed'; note: string; updated_at?: string | null; assigned_caregiver_id?: string | null; assigned_caregiver_name?: string | null; }
export type MedicationCheckInStatus = 'taken' | 'skipped' | 'missed' | 'pending';
export interface FamilyInviteResponse { id: string; code: string; role: string; expires_in_seconds: number; synthetic_demo?: boolean; }
export interface MedicationPlan { id: string; subject_user_id: string; name: string; dose: string; schedule: string; instructions: string; active: boolean; version: number; assigned_caregiver_id?: string | null; }

const token = () => sessionStorage.getItem('one_access_token');
const homeId = () => sessionStorage.getItem('one_home_id') ?? 'current';
export const accessToken = token;

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
  if (!response.ok) throw new Error(`API_${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export function mapBackendEvent(event: BackendEvent): HomeEvent {
  const isObject = event.event_type === 'object_observed';
  return { id: event.id, type: isObject ? 'object.last_seen' : 'presence.changed', title: isObject ? 'Object observed' : 'Meaningful moment', detail: event.explanation || 'An observation is available for review.', occurredAt: event.last_seen_at ?? event.first_seen_at ?? new Date().toISOString(), tone: isObject ? 'blue' : 'green' };
}

export const api = {
  getSession: async (): Promise<Session> => demoMode ? demoSession : request<MeResponse>('/me'),
  getScene: async (): Promise<Scene> => {
    if (demoMode) return demoScene;
    const result = await request<SceneResponse>(`/homes/${homeId()}/scene`);
    return { sceneId: result.sceneId ?? 'scene-empty', version: result.version, zones: result.zones ?? [], mapId: result.mapId, coordinateFrame: result.coordinateFrame };
  },
  getCurrentMap: async (): Promise<MapResponse | null> => {
    if (demoMode) return { id: demoScene.sceneId, revision: demoScene.version, coordinate_frame: 'roomplan-local', map_data: { zones: demoScene.zones } };
    try { return await request<MapResponse>(`/homes/${homeId()}/maps/current`); } catch (error) { if (error instanceof Error && error.message === 'API_404') return null; throw error; }
  },
  getObjects: async (): Promise<LastSeenObject[]> => demoMode ? demoObjects : (await request<ObjectResponse>(`/homes/${homeId()}/objects/last-seen`)).data,
  getEvents: async (): Promise<HomeEvent[]> => demoMode ? demoEvents : request<{ data: BackendEvent[] }>(`/homes/${homeId()}/events?limit=50`).then((r) => r.data.map(mapBackendEvent)),
  getDevice: async (): Promise<Device | null> => {
    if (demoMode) return demoDevice;
    const result = await request<CameraResponse>(`/homes/${homeId()}/cameras`);
    return result.data[0] ?? null;
  },
  startPairing: async (displayName: string, homeName = 'ONE Home', role: 'resident' | 'caregiver' = 'resident'): Promise<PairStartResponse> => demoMode ? { pairing_code: '482701', expires_in_seconds: 600, home_id: 'home-demo', user_id: 'user-demo', role } : request('/pairing/start', { method: 'POST', auth: false, body: JSON.stringify({ display_name: displayName, home_name: homeName, role } satisfies PairStartInput) }),
  createAccount: async (displayName: string, email: string, homeName: string): Promise<PairStartResponse> => {
    if (demoMode) return api.startPairing(displayName, homeName, 'caregiver');
    return request('/pairing/start', { method: 'POST', auth: false, body: JSON.stringify({ display_name: displayName, email: email || null, home_name: homeName || 'ONE Home', role: 'admin' } satisfies PairStartInput) });
  },
  requestEmailCode: async (purpose: 'create' | 'login', email: string, displayName?: string, homeName?: string): Promise<EmailChallenge> => demoMode ? { verification_id: 'email-demo', expires_in_seconds: 600, delivery: 'development_outbox', dev_code: '482701', email: email.trim().toLowerCase(), purpose, home_id: 'home-demo', user_id: 'user-demo', role: 'admin' } : request<EmailChallenge>('/auth/email/request', { method: 'POST', auth: false, body: JSON.stringify({ purpose, email, display_name: displayName || null, home_name: homeName || 'ONE Home', role: 'admin' }) }),
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
  completePairing: async (code: string): Promise<PairCompleteResponse> => { const result = demoMode ? { access_token: 'demo', token_type: 'bearer', expires_in: 3600, home_id: 'home-demo', user_id: 'user-demo' } : await request<PairCompleteResponse>('/pairing/complete', { method: 'POST', auth: false, body: JSON.stringify({ code }) }); sessionStorage.setItem('one_access_token', result.access_token); sessionStorage.setItem('one_home_id', result.home_id); sessionStorage.setItem('one_user_id', result.user_id); return result; },
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
  getFamilyMembers: async (): Promise<FamilyMember[]> => demoMode ? [] : (await request<{ data: FamilyMember[] }>(`/homes/${homeId()}/family/members`)).data,
  createFamilyInvite: async (displayName: string, email: string, role: 'resident' | 'caregiver' = 'caregiver'): Promise<FamilyInviteResponse> => demoMode ? { id: 'invite-demo', code: '482701', role, expires_in_seconds: 86400, synthetic_demo: true } : request<FamilyInviteResponse>(`/homes/${homeId()}/family/invites`, { method: 'POST', body: JSON.stringify({ display_name: displayName, email: email || null, role, expires_in_seconds: 86400 }) }),
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
