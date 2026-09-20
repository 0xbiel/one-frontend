import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  ChevronRight,
  Copy,
  Map,
  Video,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, demoMode } from "../api/client";
import type { HomeEvent, LastSeenObject, Session } from "../models/domain";
import { EventRow, ObjectCard } from "./shared";

type Pairing = { pairing_id: string; code: string; expires_at: string };

export function OverviewPage({
  events,
  objects,
  onEvent,
  session,
}: {
  events: HomeEvent[];
  objects: LastSeenObject[];
  onEvent: (event: HomeEvent) => void;
  session?: Session;
}) {
  const navigate = useNavigate();
  const query = useQueryClient();
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState("");
  const [pairingCopied, setPairingCopied] = useState(false);
  const [cameraLabel, setCameraLabel] = useState("Hallway camera");
  const [cameraRoom, setCameraRoom] = useState("Hallway");
  const [cameraSetupBusy, setCameraSetupBusy] = useState(false);
  const [cameraSetupSaved, setCameraSetupSaved] = useState(false);
  const [resumeCameraId, setResumeCameraId] = useState<string | null>(null);
  const camerasQuery = useQuery({
    queryKey: ["cameras"],
    queryFn: api.getCameras,
    retry: false,
  });
  const savedCamera = camerasQuery.data?.[0] ?? null;
  const pairingStatusQuery = useQuery({
    queryKey: ["pairing-status", pairing?.pairing_id],
    queryFn: () => api.getPairingStatus(pairing!.pairing_id),
    enabled: pairingOpen && Boolean(pairing?.pairing_id),
    refetchInterval: pairingOpen && pairing ? 3000 : false,
    retry: false,
  });
  const resumedCamera = camerasQuery.data?.find((camera) => camera.id === resumeCameraId) ?? null;
  const pairedCamera = pairingStatusQuery.data?.status === "connected" ? pairingStatusQuery.data.device : null;
  const activeCamera = pairedCamera
    ? { id: pairedCamera.id, label: pairedCamera.label, metadata: {} as Record<string, unknown> }
    : resumedCamera
      ? { id: resumedCamera.id, label: resumedCamera.label, metadata: resumedCamera.metadata ?? {} }
      : null;
  const cameraConnected = Boolean(activeCamera);
  const pairingExpired = pairingStatusQuery.data?.status === "expired";
  const homeName = session?.home.name ?? "The García home";
  const residentName = session?.home.residentName ?? "María";
  const checkInEvent = events.find((event) => /check[- ]?in/i.test(`${event.title} ${event.detail}`));

  useEffect(() => {
    if (!pairingOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPairingOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pairingOpen]);

  const openPairing = async (forceNew = false) => {
    setPairingOpen(true);
    setPairingError("");
    if (!forceNew && pairing) return;
    if (!forceNew && savedCamera && !demoMode) {
      setPairing(null);
      setResumeCameraId(savedCamera.id);
      setCameraSetupSaved(true);
      setCameraLabel(savedCamera.label);
      const room = savedCamera.metadata?.room;
      setCameraRoom(typeof room === "string" && room ? room : "Hallway");
      return;
    }
    setResumeCameraId(null);
    setPairing(null);
    setPairingCopied(false);
    setCameraSetupSaved(false);
    setCameraLabel("Hallway camera");
    setCameraRoom("Hallway");
    setPairingBusy(true);
    try {
      setPairing(await api.createPairing("Hallway phone"));
    } catch {
      setPairingError(
        "We could not create a camera code. Sign in as an admin or caregiver and try again.",
      );
    } finally {
      setPairingBusy(false);
    }
  };

  const copyPairingCode = async () => {
    if (!pairing) return;
    try {
      await navigator.clipboard?.writeText(pairing.code);
      setPairingCopied(true);
      window.setTimeout(() => setPairingCopied(false), 1600);
    } catch {
      setPairingError("Copy is unavailable here. Enter the six digits manually.");
    }
  };

  const saveCameraSetup = async () => {
    const cameraId = activeCamera?.id;
    if (cameraSetupBusy || !cameraId || !cameraLabel.trim()) return;
    setCameraSetupBusy(true);
    setPairingError("");
    try {
      await api.updateCamera(cameraId, {
        name: cameraLabel.trim(),
        metadata: { ...(activeCamera?.metadata ?? {}), room: cameraRoom, setup_state: "configured" },
      });
      setCameraSetupSaved(true);
      void query.invalidateQueries({ queryKey: ["camera"] });
      void query.invalidateQueries({ queryKey: ["cameras"] });
    } catch {
      setPairingError(
        "We could not save this camera setup. Check the local connection and try again.",
      );
    } finally {
      setCameraSetupBusy(false);
    }
  };

  return (
    <div className="home-page">
      <section className="home-heading">
        <span className="eyebrow">{homeName.toUpperCase()}</span>
        <h2>Your home, in view.</h2>
      </section>

      <section className="home-camera-hero">
        <div className="home-camera-hero-top">
          <span className="home-camera-label"><Camera size={15} /> ROOM CAMERA</span>
          <span className={`home-camera-state ${savedCamera?.status === "online" ? "online" : ""}`}>
            <span className="status-dot" /> {savedCamera ? savedCamera.status.toUpperCase() : "NOT PAIRED"}
          </span>
        </div>
        <div className="home-camera-mark" aria-hidden="true"><Camera size={64} strokeWidth={1.35} /></div>
        <div className="home-camera-hero-bottom">
          <div>
            <h3>{savedCamera ? savedCamera.label : "No room camera connected"}</h3>
            <p>{savedCamera ? "Review the camera name, placement, or room map." : "Pair a phone or laptop to add a room view."}</p>
          </div>
          <button className="home-camera-action" onClick={() => void openPairing()}>
            {savedCamera ? "Camera setup" : "Pair camera"} <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {pairingOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPairingOpen(false)}
        >
          <section
            className="panel pairing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-pairing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close camera pairing"
              onClick={() => setPairingOpen(false)}
            >
              <X size={18} />
            </button>
            <div className="pairing-modal-heading">
              <span className="pairing-modal-icon" aria-hidden="true">
                <Camera size={18} />
              </span>
              <div>
                <span className="eyebrow">CAMERA CONNECTION</span>
                <span className="pairing-modal-device">Caregiver setup</span>
              </div>
            </div>
            <h2 id="camera-pairing-title">{resumedCamera ? "Continue saved camera" : "Connect a phone or laptop"}</h2>
            <p className="muted">
              {resumedCamera
                ? "This camera is already paired to the household. You can rename it or change its room here; positioning stays in the camera controls."
                : "Share this one-time code with the camera device. As soon as it is accepted, the camera is saved. Positioning and room mapping start only when you choose them later."}
            </p>
            <div className="pairing-progress" aria-label="Camera pairing progress">
              <span className={cameraConnected ? "complete" : "current"}>
                1 <b>Pair</b>
              </span>
              <i />
              <span className={cameraSetupSaved ? "complete" : cameraConnected ? "current" : ""}>
                2 <b>Set up</b>
              </span>
              <i />
              <span className={cameraSetupSaved ? "complete" : ""}>
                3 <b>Ready</b>
              </span>
            </div>
            {pairingBusy && (
              <p className="pairing-status" role="status">
                Creating a secure code…
              </p>
            )}
            {pairingError && (
              <div className="error-note" role="alert">
                {pairingError}
              </div>
            )}
            {pairing && (
              <div className="pairing-code pairing-code-live" role="status">
                <div className="pairing-code-heading">
                  <span className="eyebrow">ENTER THIS CODE ON THE CAMERA DEVICE</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void copyPairingCode()}
                  >
                    {pairingCopied ? (
                      <>
                        <Check size={14} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy code
                      </>
                    )}
                  </button>
                </div>
                <strong>{pairing.code}</strong>
                <span className="muted">Expires in 10 minutes · one use only</span>
              </div>
            )}
            <div
              className={`pairing-connection-state ${cameraConnected ? "connected" : pairingExpired ? "expired" : pairingStatusQuery.isError ? "unavailable" : "waiting"}`}
              role="status"
            >
              <span className="status-dot" />
              <span>
                <strong>
                  {cameraConnected
                    ? resumedCamera ? "Camera already saved" : "Camera connected and saved"
                    : pairingExpired
                      ? "Code expired"
                      : pairingStatusQuery.isError
                        ? "Connection check unavailable"
                        : pairingStatusQuery.isFetching
                          ? "Checking connection…"
                          : "Waiting for camera setup"}
                </strong>
                <small>
                  {cameraConnected
                    ? `${activeCamera?.label ?? "The device"} is linked to this household. Mapping is optional and can be resumed later.`
                    : pairingExpired
                      ? "Create a new code to start another device setup."
                      : pairingStatusQuery.isError
                        ? "The code is still visible. Check the local connection and retry."
                        : "This page checks the one-time pairing state every few seconds."}
                </small>
              </span>
            </div>
            {cameraConnected ? (
              <div className="pairing-setup-panel">
                <div className="pairing-setup-intro">
                    <span className="pairing-setup-icon" aria-hidden="true"><Camera size={17} /></span>
                  <div>
                    <span className="eyebrow">SAVED CAMERA</span>
                    <h3>Make this camera easy to recognize.</h3>
                    <p>
                      Name and placement are independent from room mapping, so
                      this camera stays on the account even if mapping is unfinished.
                    </p>
                  </div>
                </div>
                <label>
                  Camera name
                  <input
                    value={cameraLabel}
                    onChange={(event) => {
                      setCameraLabel(event.target.value);
                      setCameraSetupSaved(false);
                    }}
                    autoFocus
                  />
                </label>
                <label>
                  Placement
                  <select
                    value={cameraRoom}
                    onChange={(event) => {
                      setCameraRoom(event.target.value);
                      setCameraSetupSaved(false);
                    }}
                  >
                    <option>Hallway</option>
                    <option>Living room</option>
                    <option>Entryway</option>
                    <option>Bedroom</option>
                  </select>
                </label>
                {cameraSetupSaved && (
                  <div className="success-note" role="status">
                    <Check size={15} /> Camera setup saved for {cameraRoom}.
                  </div>
                )}
                <button
                  className="primary-button full-width"
                  onClick={() => void saveCameraSetup()}
                  disabled={cameraSetupBusy || !cameraLabel.trim()}
                >
                  {cameraSetupBusy
                    ? "Saving camera setup…"
                    : cameraSetupSaved
                      ? "Setup saved"
                      : "Save camera setup"} <ChevronRight size={16} />
                </button>
                {cameraSetupSaved && (
                  <div className="pairing-calibration-panel automatic-map-panel">
                    <div className="pairing-setup-intro">
                      <span className="pairing-setup-icon" aria-hidden="true"><Video size={17} /></span>
                      <div>
                        <span className="eyebrow">CAMERA READY</span>
                        <h3>Pairing is finished.</h3>
                        <p>Live view works now. Calibration, manual placement, and room mapping are optional and only run when you choose them from this camera&apos;s Position &amp; map menu.</p>
                      </div>
                    </div>
                    <button className="secondary-button full-width" onClick={() => { setPairingOpen(false); navigate("/dashboard/cameras"); }}>
                      <Video size={16} /> Open live view & manage camera <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="pairing-steps" aria-label="Camera setup steps">
                <div className="current">
                  <strong>1 · Connect the device</strong>
                  <span>
                    Open the camera page on the phone or laptop and enter the
                    code above.
                  </span>
                </div>
                <div className="upcoming">
                  <strong>2 · Give consent</strong>
                  <span>
                    The camera device will ask for permission before any preview
                    starts.
                  </span>
                </div>
                <div className="upcoming">
                  <strong>3 · Name and place it</strong>
                  <span>
                    Those setup choices will appear here after the connection is
                    confirmed.
                  </span>
                </div>
              </div>
            )}
            <div className="pairing-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void openPairing(true)}
                disabled={pairingBusy || Boolean(pairedCamera)}
              >
                {resumedCamera ? "Pair another camera" : "New code"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => setPairingOpen(false)}
              >
                {cameraConnected ? "Close for now" : "Done"}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECENT OBSERVATIONS</span>
            <h3>Recent observations</h3>
          </div>
          <button className="text-button" onClick={() => navigate("/dashboard/events")}>
            See all <ChevronRight size={15} />
          </button>
        </div>
        <div className="observation-grid">
          {events.slice(0, 3).map((event) => (
            <EventRow key={event.id} event={event} onClick={() => onEvent(event)} />
          ))}
        </div>
      </section>

      <section className="household-card">
        <div>
          <span className="eyebrow">TODAY’S CHECK-IN</span>
          <h3>{checkInEvent ? "A check-in is recorded." : "Waiting for today’s check-in."}</h3>
          <p>{checkInEvent ? checkInEvent.detail : `${residentName} has no recorded check-in yet today. ONE will keep the result in context with the personal baseline when it arrives.`}</p>
        </div>
        <div className="plan-status">
          <strong>{checkInEvent ? "Done" : "—"}</strong>
          <span>{checkInEvent ? "human signal" : "not recorded"}</span>
          <div className="progress-line">
            <span style={{ width: checkInEvent ? "100%" : "12%" }} />
          </div>
        </div>
        <button className="secondary-button" onClick={() => navigate("/dashboard/live")}>
          Open check-in <ChevronRight size={16} />
        </button>
      </section>

      <section className="home-section memory-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">OBJECT MEMORY</span>
            <h3>Last-seen objects</h3>
          </div>
          <button className="text-button" onClick={() => navigate("/dashboard/map")}>
            Open map <Map size={15} />
          </button>
        </div>
        <div className="object-list">
          {objects.map((object) => (
            <ObjectCard key={object.id} object={object} onClick={() => navigate("/dashboard/map")} />
          ))}
        </div>
      </section>
    </div>
  );
}
