export function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.message : "";
  if (name === "SECURE_CONTEXT_REQUIRED") {
    return "Camera access needs a secure page. Open the Tailscale HTTPS address on this iPhone instead of localhost, then retry.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was blocked. In iPhone Settings, allow Camera and Microphone for this browser, then reload this HTTPS page.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Check that the phone has a working camera and retry.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is busy in another app. Close other camera or video tabs, then retry.";
  }
  if (name === "OverconstrainedError") {
    return "That camera mode is unavailable. ONE will retry with the phone's available camera.";
  }
  if (name === "CAMERA_PREVIEW_NOT_READY") {
    return "The preview did not become ready. Keep this HTTPS page open, check camera permission, and retry.";
  }
  if (name === "CAMERA_FRAME_ENCODING_UNAVAILABLE") {
    return "This browser could not prepare the room sweep. Reload the HTTPS page and retry on a recent Safari or Chrome.";
  }
  if (name === "CAMERA_NOT_REGISTERED") {
    return "The camera connected, but its household record is not ready yet. Keep the caregiver page open for a moment and retry.";
  }
  if (name === "API_401" || name === "API_403") {
    return "The camera session is no longer authorized. Ask the caregiver for a new code and reconnect this device.";
  }
  if (name === "API_413" || name === "API_422") {
    return "The room sweep was not accepted. Keep the phone steady, use the rear camera, and retry the sweep.";
  }
  if (name === "API_503") {
    return "The local room-layout service is unavailable. Keep this page open and ask the caregiver to start the local service, then retry.";
  }
  if (name === "AbortError") return "The room sweep was paused. Resume the preview to try again.";
  return "ONE could not finish this camera step. Check the secure connection and retry safely.";
}

export function describeLiveKitError(): string {
  return "Preview is on, but the secure live connection did not complete. On iPhone, use the Tailscale HTTPS address and make sure the LiveKit address is reachable, then retry publishing.";
}
