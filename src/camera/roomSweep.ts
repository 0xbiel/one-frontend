// Treat the browser capture as a short room walkthrough rather than a
// calibration pose.  Twenty spaced keyframes is still inside the backend's
// bounded request contract, but gives moving phones more visual coverage than
// the old "hold steady and pan" flow.
export const ROOM_SWEEP_FRAME_COUNT = 20;
export const ROOM_SWEEP_DURATION_MS = 14_000;
export const ROOM_SWEEP_MAX_DIMENSION = 640;
export const ROOM_SWEEP_JPEG_QUALITY = 0.58;

export interface RoomSweepFrame {
  index: number;
  captured_at: string;
  frame_base64: string;
  width: number;
  height: number;
}

export interface RoomSweepCapture {
  frames: RoomSweepFrame[];
  resolutionWidth: number;
  resolutionHeight: number;
  orientation: "portrait" | "landscape" | "square";
}

export interface RoomSweepOptions {
  frameCount?: number;
  durationMs?: number;
  maxDimension?: number;
  jpegQuality?: number;
  signal?: AbortSignal;
  onProgress?: (captured: number, total: number) => void;
}

export function preferredCameraConstraints(): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
    },
    audio: true,
  };
}

export function createCaptureId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `camera-capture-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function abortError(): DOMException {
  return new DOMException("Room sweep was cancelled.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    const cancel = () => {
      window.clearTimeout(timeout);
      reject(abortError());
    };
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

async function waitForVideo(video: HTMLVideoElement, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) return;
  await new Promise<void>((resolve, reject) => {
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", ready);
      video.removeEventListener("canplay", ready);
      signal?.removeEventListener("abort", cancel);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const cancel = () => {
      cleanup();
      reject(abortError());
    };
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("CAMERA_PREVIEW_NOT_READY"));
    }, 8_000);
    video.addEventListener("loadedmetadata", ready, { once: true });
    video.addEventListener("canplay", ready, { once: true });
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

function videoDimensions(video: HTMLVideoElement, stream: MediaStream): { width: number; height: number } {
  const settings = stream.getVideoTracks()[0]?.getSettings();
  const width = settings?.width ?? video.videoWidth;
  const height = settings?.height ?? video.videoHeight;
  if (!width || !height) throw new Error("CAMERA_PREVIEW_NOT_READY");
  return { width, height };
}

function orientationFor(width: number, height: number): RoomSweepCapture["orientation"] {
  return width === height ? "square" : width > height ? "landscape" : "portrait";
}

function captureFrame(
  video: HTMLVideoElement,
  index: number,
  capturedAt: string,
  maxDimension: number,
  jpegQuality: number,
): RoomSweepFrame {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("CAMERA_PREVIEW_NOT_READY");
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("CAMERA_FRAME_ENCODING_UNAVAILABLE");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return {
    index,
    captured_at: capturedAt,
    frame_base64: stripDataUrlPrefix(canvas.toDataURL("image/jpeg", jpegQuality)),
    width: canvas.width,
    height: canvas.height,
  };
}

export function captureCurrentCameraFrame(
  video: HTMLVideoElement,
  maxDimension = ROOM_SWEEP_MAX_DIMENSION,
  jpegQuality = ROOM_SWEEP_JPEG_QUALITY,
): RoomSweepFrame {
  return captureFrame(video, 0, new Date().toISOString(), maxDimension, jpegQuality);
}

export async function captureFixedCameraFrames(
  video: HTMLVideoElement,
  stream: MediaStream,
  options: Pick<RoomSweepOptions, 'signal' | 'onProgress' | 'maxDimension' | 'jpegQuality'> & { frameCount?: number; durationMs?: number } = {},
): Promise<RoomSweepFrame[]> {
  const frameCount = Math.min(8, Math.max(1, options.frameCount ?? 6));
  const durationMs = Math.max(0, options.durationMs ?? 1_600);
  await waitForVideo(video, options.signal);
  videoDimensions(video, stream);
  const interval = frameCount > 1 ? durationMs / (frameCount - 1) : 0;
  const startedAt = performance.now();
  const frames: RoomSweepFrame[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const targetTime = index * interval;
    const elapsed = performance.now() - startedAt;
    if (targetTime > elapsed) await wait(targetTime - elapsed, options.signal);
    throwIfAborted(options.signal);
    frames.push(captureFrame(video, index, new Date().toISOString(), options.maxDimension ?? 640, options.jpegQuality ?? 0.68));
    options.onProgress?.(frames.length, frameCount);
  }
  return frames;
}

export async function captureRoomSweep(
  video: HTMLVideoElement,
  stream: MediaStream,
  options: RoomSweepOptions = {},
): Promise<RoomSweepCapture> {
  const frameCount = Math.min(20, Math.max(12, options.frameCount ?? ROOM_SWEEP_FRAME_COUNT));
  const durationMs = Math.max(0, options.durationMs ?? ROOM_SWEEP_DURATION_MS);
  const maxDimension = options.maxDimension ?? ROOM_SWEEP_MAX_DIMENSION;
  const jpegQuality = options.jpegQuality ?? ROOM_SWEEP_JPEG_QUALITY;
  await waitForVideo(video, options.signal);
  const { width: sourceWidth, height: sourceHeight } = videoDimensions(video, stream);
  const frames: RoomSweepFrame[] = [];
  const startedAt = performance.now();
  const interval = frameCount > 1 ? durationMs / (frameCount - 1) : 0;

  for (let index = 0; index < frameCount; index += 1) {
    const targetTime = interval * index;
    const elapsed = performance.now() - startedAt;
    if (targetTime > elapsed) await wait(targetTime - elapsed, options.signal);
    throwIfAborted(options.signal);
    frames.push(captureFrame(video, index, new Date().toISOString(), maxDimension, jpegQuality));
    options.onProgress?.(frames.length, frameCount);
  }

  const firstFrame = frames[0];
  return {
    frames,
    // The API resolution describes the encoded samples it will process, not
    // the full sensor mode. This keeps the iPhone payload and its metadata in
    // agreement after the 640px privacy-preserving downsample.
    resolutionWidth: firstFrame?.width ?? sourceWidth,
    resolutionHeight: firstFrame?.height ?? sourceHeight,
    orientation: orientationFor(sourceWidth, sourceHeight),
  };
}
