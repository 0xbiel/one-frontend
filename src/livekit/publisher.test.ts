import { describe, expect, it, vi } from 'vitest';
import { connectPublisher } from './publisher';

const livekit = vi.hoisted(() => ({
  publishTrack: vi.fn(async (track: unknown, options: unknown) => ({ track, options })),
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(),
}));

vi.mock('livekit-client', () => ({
  LocalVideoTrack: class { constructor(public track: unknown) {} },
  LocalAudioTrack: class { constructor(public track: unknown) {} },
  Room: class {
    localParticipant = { publishTrack: livekit.publishTrack };
    on() { return this; }
    connect = livekit.connect;
    disconnect = livekit.disconnect;
  },
  RoomEvent: { Disconnected: 'disconnected' },
  Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
}));

describe('camera publishing', () => {
  it('labels video as camera and audio as microphone for Android subscribers', async () => {
    livekit.publishTrack.mockClear();
    const videoTrack = { kind: 'video' };
    const audioTrack = { kind: 'audio' };
    const stream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack],
    } as unknown as MediaStream;

    await connectPublisher('ws://localhost:7880', 'test-token', stream);

    expect(livekit.publishTrack).toHaveBeenCalledTimes(2);
    expect(livekit.publishTrack.mock.calls[0][1]).toEqual({ source: 'camera' });
    expect(livekit.publishTrack.mock.calls[1][1]).toEqual({ source: 'microphone' });
  });
});
