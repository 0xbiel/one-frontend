import { LocalAudioTrack, LocalVideoTrack, Room, RoomEvent } from 'livekit-client';

export interface PublisherConnection { room: Room; disconnect: () => void; }

/** Connects a consented publisher using the tracks already shown in its preview. */
export async function connectPublisher(url: string, token: string, stream: MediaStream): Promise<PublisherConnection> {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  let disposed = false;
  const disconnect = () => {
    if (disposed) return;
    disposed = true;
    room.disconnect();
  };
  room.on(RoomEvent.Disconnected, () => { disposed = true; });
  try {
    await room.connect(url, token, { autoSubscribe: false });
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    if (!videoTrack || !audioTrack) throw new Error('CAMERA_TRACKS_UNAVAILABLE');
    // Reuse the user-approved preview tracks. Calling setCameraEnabled and
    // setMicrophoneEnabled here would request a second capture on iOS Safari.
    await room.localParticipant.publishTrack(new LocalVideoTrack(videoTrack, undefined, true));
    await room.localParticipant.publishTrack(new LocalAudioTrack(audioTrack, undefined, true));
    return { room, disconnect };
  } catch (error) {
    disconnect();
    throw error;
  }
}
