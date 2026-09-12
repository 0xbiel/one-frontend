import { Room, RoomEvent } from 'livekit-client';

export interface PublisherConnection { room: Room; disconnect: () => void; }

/** Connects a consented publisher to the backend-issued LiveKit room. */
export async function connectPublisher(url: string, token: string): Promise<PublisherConnection> {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(url, token, { autoSubscribe: false });
  await room.localParticipant.setCameraEnabled(true);
  await room.localParticipant.setMicrophoneEnabled(true);
  const disconnect = () => { room.disconnect(); };
  room.on(RoomEvent.Disconnected, disconnect);
  return { room, disconnect };
}
