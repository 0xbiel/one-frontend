let activeStream: MediaStream | null = null;
let activeDisconnect: (() => void) | null = null;

export function registerPublisherStream(stream: MediaStream) { activeStream = stream; }
export function registerPublisherConnection(disconnect: () => void) { activeDisconnect = disconnect; }
export function clearPublisherRegistry() { activeStream = null; activeDisconnect = null; }

/** Synchronously stops local capture before the privacy API request is sent. */
export function stopActivePublisher() {
  activeStream?.getTracks().forEach((track) => track.stop());
  activeDisconnect?.();
  clearPublisherRegistry();
}
