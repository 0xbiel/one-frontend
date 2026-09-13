import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';

export interface ViewerConnection {
  room: Room;
  disconnect: () => Promise<void>;
}

export interface ViewerCallbacks {
  signal?: AbortSignal;
  preferredIdentity?: string;
  onVideoParticipant?: (identity: string) => void;
  onVideoEnded?: () => void;
  onDisconnected?: () => void;
}

/** Connect a caregiver as a subscriber and attach only the selected camera feed. */
export async function connectViewer(
  url: string,
  token: string,
  videoElement: HTMLVideoElement,
  audioElement: HTMLAudioElement | null,
  callbacks: ViewerCallbacks = {},
): Promise<ViewerConnection> {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  let disposed = false;
  let activeVideoTrack: RemoteTrack | null = null;
  const attachedTracks = new Set<RemoteTrack>();
  let disconnectPromise: Promise<void> | null = null;

  const matchesPreferredParticipant = (participant: RemoteParticipant) =>
    !callbacks.preferredIdentity || participant.identity === callbacks.preferredIdentity;

  const attachTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
    if (disposed || !matchesPreferredParticipant(participant)) return;
    if (track.kind === Track.Kind.Video) {
      if (activeVideoTrack && activeVideoTrack !== track) return;
      track.attach(videoElement);
      // The video element has no audio of its own, so it can start without a
      // user gesture while the separate audio element remains muted by default.
      videoElement.muted = true;
      void videoElement.play().catch(() => undefined);
      activeVideoTrack = track;
      attachedTracks.add(track);
      callbacks.onVideoParticipant?.(participant.identity);
      return;
    }
    if (track.kind === Track.Kind.Audio && audioElement) {
      track.attach(audioElement);
      attachedTracks.add(track);
    }
  };

  const requestSubscription = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (disposed || !matchesPreferredParticipant(participant)) return;
    if (publication.kind !== Track.Kind.Video && publication.kind !== Track.Kind.Audio) return;
    if (publication.track) attachTrack(publication.track, participant);
    if (!publication.isDesired) publication.setSubscribed(true);
  };

  const subscribeToParticipant = (participant: RemoteParticipant) => {
    for (const publication of participant.trackPublications.values()) {
      requestSubscription(publication, participant);
    }
  };

  const detachTrack = (track: RemoteTrack) => {
    if (track.kind === Track.Kind.Video) track.detach(videoElement);
    else if (audioElement) track.detach(audioElement);
    attachedTracks.delete(track);
    if (activeVideoTrack === track) {
      activeVideoTrack = null;
      callbacks.onVideoEnded?.();
    }
  };

  const handleTrackSubscribed = (track: RemoteTrack, _publication: unknown, participant: RemoteParticipant) => {
    attachTrack(track, participant);
  };
  const handleTrackUnsubscribed = (track: RemoteTrack) => {
    detachTrack(track);
  };
  const handleParticipantConnected = (participant: RemoteParticipant) => {
    subscribeToParticipant(participant);
  };
  const handleTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    requestSubscription(publication, participant);
  };
  const handleDisconnected = () => {
    if (!disposed) callbacks.onDisconnected?.();
  };

  room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
  room.on(RoomEvent.TrackPublished, handleTrackPublished);
  room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
  room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
  room.on(RoomEvent.Disconnected, handleDisconnected);

  const disconnect = async () => {
    if (disconnectPromise) return disconnectPromise;
    disposed = true;
    callbacks.signal?.removeEventListener('abort', handleAbort);
    for (const track of [...attachedTracks]) detachTrack(track);
    room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.off(RoomEvent.TrackPublished, handleTrackPublished);
    room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.off(RoomEvent.Disconnected, handleDisconnected);
    disconnectPromise = room.disconnect();
    return disconnectPromise;
  };

  const handleAbort = () => {
    void disconnect();
  };

  if (callbacks.signal?.aborted) {
    await disconnect();
    throw new Error('VIEWER_CONNECTION_CANCELLED');
  }
  callbacks.signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    // Subscribe explicitly to the selected camera. This avoids depending on
    // the SDK's initial auto-subscribe race when the camera joins concurrently.
    await room.connect(url, token, {
      autoSubscribe: false,
      peerConnectionTimeout: 10_000,
      websocketTimeout: 10_000,
    });
    if (callbacks.signal?.aborted || disposed) throw new Error('VIEWER_CONNECTION_CANCELLED');

    // Existing publications can be available immediately after connect, while
    // the event handlers above cover cameras that publish a moment later.
    for (const participant of room.remoteParticipants.values()) {
      subscribeToParticipant(participant);
    }
    return { room, disconnect };
  } catch (error) {
    await disconnect();
    throw error;
  }
}
