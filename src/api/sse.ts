import { fetchEventSource } from '@microsoft/fetch-event-source';
import { accessToken, API_BASE, demoMode } from './client';
import type { HomeEvent } from '../models/domain';

/** EventBus payload emitted by FastAPI's `one.event.v1` SSE stream. */
export interface OneEventEnvelope {
  id?: string;
  event_id?: string;
  type?: string;
  event_type?: string;
  status?: string;
  confidence?: number;
  care_recipient_id?: string | null;
  snapshot_path?: string | null;
  snapshot_content_type?: string | null;
  occurred_at?: string;
  observed_at?: string;
  home_id: string;
  entity?: { type: string; id: string };
  version?: number;
  payload?: Record<string, unknown>;
}

export async function streamHomeEvents(homeId: string, onEvent: (event: OneEventEnvelope) => void, signal?: AbortSignal) {
  if (demoMode) return;
  await fetchEventSource(`${API_BASE}/homes/${homeId}/events/stream`, {
    signal,
    credentials: 'include',
    headers: { Accept: 'text/event-stream', ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}) },
    openWhenHidden: true,
    onmessage(message) {
      if (message.event === 'one.heartbeat.v1' || !message.data) return;
      try {
        const event = JSON.parse(message.data) as OneEventEnvelope;
        onEvent({ ...event, id: event.id ?? message.id ?? event.event_id });
      } catch { /* next reconnect will resync */ }
    },
    onerror(error) { throw error; },
  });
}

export function eventToHomeEvent(event: OneEventEnvelope): HomeEvent {
  const rawType = event.type ?? event.event_type;
  const type = rawType === 'fall_suspected' ? 'fall.suspected' : rawType === 'object_observed' ? 'object.last_seen' : rawType === 'daily_check_in' || rawType === 'check_in' ? 'daily.check_in' : rawType === 'privacy.changed' ? 'privacy.changed' : rawType === 'device.status' ? 'device.status' : 'presence.changed';
  const title = typeof event.payload?.title === 'string' ? event.payload.title : type === 'fall.suspected' ? 'Possible fall pattern' : type === 'daily.check_in' ? 'Daily check-in recorded' : type.replace('.', ' ');
  const detail = typeof event.payload?.detail === 'string' ? event.payload.detail : type === 'fall.suspected' ? 'A possible fall pattern is ready for human review.' : type === 'daily.check_in' ? 'A daily check-in is available for caregiver review.' : 'A new observation is available.';
  return { id: event.id ?? event.event_id ?? `${event.home_id}-${event.observed_at ?? event.occurred_at ?? 'event'}`, type, title, detail, occurredAt: event.occurred_at ?? event.observed_at ?? new Date().toISOString(), status: typeof event.payload?.status === 'string' ? event.payload.status : event.status, confidence: event.confidence, careRecipientId: event.care_recipient_id, snapshotPath: event.snapshot_path, snapshotContentType: event.snapshot_content_type, tone: type === 'fall.suspected' || type === 'privacy.changed' ? 'amber' : type === 'device.status' ? 'green' : 'blue' };
}
