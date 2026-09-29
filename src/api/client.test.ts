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
    const event = mapBackendEvent({ id: 'evt-1', event_type: 'object_observed', status: 'new', explanation: 'Approximate household observation; not a diagnosis.', confidence: 0.8, evidence_ids: '[]', last_seen_at: '2026-09-12T10:00:00Z', source: { camera_id: 'camera-1', camera_name: 'Kitchen', room_name: 'Kitchen' } });
    expect(event.type).toBe('object.last_seen');
    expect(event.detail).toContain('not a diagnosis');
    expect(event.occurredAt).toBe('2026-09-12T10:00:00Z');
    expect(event.cameraId).toBe('camera-1');
  });

  it('maps the backend SSE payload shape without requiring a frontend envelope', () => {
    const event = eventToHomeEvent({ home_id: 'home-1', type: 'object_observed', event_id: 'evt-sse', observed_at: '2026-09-12T10:01:00Z' });
    expect(event.id).toBe('evt-sse');
    expect(event.type).toBe('object.last_seen');
    expect(event.occurredAt).toBe('2026-09-12T10:01:00Z');
  });

  it('keeps map revisions and invite codes on the explicit demo contract', async () => {
    const map = await api.getCurrentMap();
    expect(map?.revision).toBeGreaterThan(0);
    expect(map?.coordinate_frame).toBe('camera-relative-image');
    const invite = await api.createFamilyInvite('Test caregiver', 'test@example.com');
    expect(invite.code).toMatch(/^\d{6}$/);
  });

  it('keeps family access mutations demo-safe', async () => {
    const changed = await api.updateFamilyMember('jordi-demo', 'resident');
    expect(changed.data.id).toBe('jordi-demo');
    expect(changed.data.role).toBe('resident');
    expect(changed.invalidated_sessions).toBe(0);

    const removed = await api.removeFamilyMember('jordi-demo');
    expect(removed.data.id).toBe('jordi-demo');
    expect(removed.invalidated_sessions).toBe(0);
  });

  it('saves a daily answer without inventing response time or pulse', async () => {
    const result = await api.submitDailyCheckIn({ questions: [{ question: '¿Cómo te encuentras hoy?', answer: 'Bien', responseTimeMs: null, baselineMs: null, pulseBpm: null }] });
    const questions = await api.getCheckInQuestions();
    const saved = questions.find((item) => item.summaryId === result.id);
    expect(saved?.answer).toBe('Bien');
    expect(saved?.responseTimeMs).toBeNull();
    expect(saved?.pulseBpm).toBeNull();
  });
});
