import { describe, expect, it } from 'vitest';
import { api, mapBackendEvent } from './client';
import { eventToHomeEvent } from './sse';

describe('FastAPI contract mapping', () => {
  it('persists pairing credentials and clears the browser session on logout', async () => {
    sessionStorage.clear();
    await api.completePairing('482701');
    expect(sessionStorage.getItem('one_access_token')).toBe('demo');
    sessionStorage.setItem('unrelated-session-state', 'cleared-on-sign-out');
    await api.logout();
    expect(sessionStorage.length).toBe(0);
  });

  it('maps object_observed events to non-diagnostic UI language', () => {
    const event = mapBackendEvent({ id: 'evt-1', event_type: 'object_observed', status: 'new', explanation: 'Approximate household observation; not a diagnosis.', confidence: 0.8, evidence_ids: '[]', last_seen_at: '2026-09-12T10:00:00Z' });
    expect(event.type).toBe('object.last_seen');
    expect(event.detail).toContain('not a diagnosis');
    expect(event.occurredAt).toBe('2026-09-12T10:00:00Z');
  });

  it('maps the backend SSE payload shape without requiring a frontend envelope', () => {
    const event = eventToHomeEvent({ home_id: 'home-1', type: 'object_observed', event_id: 'evt-sse', observed_at: '2026-09-12T10:01:00Z' });
    expect(event.id).toBe('evt-sse');
    expect(event.type).toBe('object.last_seen');
    expect(event.occurredAt).toBe('2026-09-12T10:01:00Z');
  });
});
