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
import { Link, useNavigate } from "react-router-dom";
import { api, demoMode, getCameraReconnect } from "../api/client";
import { rememberDashboardSession } from "./cameraReturnSession";
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
  const currentMapQuery = useQuery({
    queryKey: ["current-map", "pairing"],
    queryFn: api.getCurrentMap,
    enabled: pairingOpen && cameraConnected,
    refetchInterval: pairingOpen && cameraConnected ? 4000 : false,
    retry: false,
  });
  const mapGenerationQuery = useQuery({
    queryKey: ["map-generation", "pairing", activeCamera?.id],
    queryFn: () => api.getLatestMapGeneration(activeCamera!.id),
    enabled: pairingOpen && Boolean(activeCamera?.id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ["ready", "needs_rescan", "unavailable", "failed"].includes(status) ? false : 1500;
    },
    retry: false,
  });
  const mapGenerationStatus = mapGenerationQuery.data?.status;
  const currentMap = currentMapQuery.data;
  const cameraMapReady = mapGenerationStatus === "ready" && Boolean(mapGenerationQuery.data?.map_id) && currentMap?.id === mapGenerationQuery.data?.map_id && currentMap?.source === "camera-cv-2d" && currentMap?.dimension === "2d" && Boolean(currentMap.map_data?.geometry);
  const cameraMapTitle = cameraMapReady
    ? "Camera map ready."
    : mapGenerationStatus === "needs_rescan"
      ? "A slower sweep is needed."
      : mapGenerationStatus === "unavailable"
        ? "Room-layout service unavailable."
        : mapGenerationStatus === "failed"
          ? "Map generation needs attention."
          : mapGenerationStatus === "processing"
            ? "Building the camera map."
            : "Waiting for the room sweep.";
  const cameraMapDescription = cameraMapReady
    ? "The camera-derived geometry is saved and available in Home map."
    : mapGenerationStatus === "needs_rescan"
      ? "The last walkthrough did not make a confident map. The camera itself is still saved and usable; retry only when you want better room context."
      : mapGenerationStatus === "unavailable"
        ? "Room mapping is temporarily unavailable. The paired camera remains saved and can still be used."
        : mapGenerationStatus === "failed"
          ? "The room draft could not be built. You can retry the walkthrough later without pairing the camera again."
          : "On the camera device, preview first and record a short room walkthrough when convenient. Mapping is optional for basic live and object vision.";
  const homeName = session?.home.name ?? "The García home";
  const residentName = session?.home.residentName ?? "María";
  const checkInEvent = events.find((event) => /check[- ]?in/i.test(`${event.title} ${event.detail}`) && new Date(event.occurredAt).toDateString() === new Date().toDateString());
  const dailyQuestionsQuery = useQuery({ queryKey: ["check-in-questions"], queryFn: api.getCheckInQuestions, enabled: session?.actor.role !== "resident", retry: false });
  const todayQuestion = dailyQuestionsQuery.data?.find((item) => new Date(item.askedAt).toDateString() === new Date().toDateString());
  const hasCheckIn = Boolean(checkInEvent || todayQuestion);

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
        <h2>Your Home, in view</h2>
        <p className="home-heading-subtitle">A calm overview of today’s care, activity and home signals.</p>
      </section>

      <section className="home-camera-hero">
        <div className="home-camera-hero-top">
          <span className="home-camera-label"><Camera size={15} /> ROOM CAMERA</span>
          <span className={`home-camera-state ${savedCamera?.status === "online" ? "online" : ""}`}>
            <span className="status-dot" /> {savedCamera ? savedCamera.status.toUpperCase() : "NOT PAIRED"}
          </span>
        </div>
        <div className="home-camera-art" aria-hidden="true">
          <svg viewBox="0 0 900 210" preserveAspectRatio="none">
            <defs><linearGradient id="one-wave" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#0b5967" /><stop offset=".6" stopColor="#087f9e" /><stop offset="1" stopColor="#0a3c58" /></linearGradient></defs>
            <path d="M0 140 C180 40 250 160 425 80 S680 15 900 115 L900 210 L0 210Z" fill="url(#one-wave)" opacity=".82"/>
            <path d="M0 168 C200 90 300 195 495 85 S705 60 900 148 L900 210 L0 210Z" fill="#062e47" opacity=".84"/>
            <path d="M10 150 C195 47 285 158 450 66 S706 21 887 126" fill="none" stroke="#53d8f4" strokeWidth="2"/>
            <circle cx="690" cy="36" r="18" fill="#adf5ff"/>
            <path d="M550 106 l38 -31 38 31 h-9 v40 h-57 v-40z" fill="#e9fbff"/>
            <path d="M576 118 h17 v28 h-17z" fill="#8cbaf9"/>
            <path d="M603 113 h10 v12 h-10z" fill="#8cbaf9"/>
          </svg>
        </div>
        <div className="home-camera-hero-bottom">
          <div>
            <h3>{savedCamera ? savedCamera.label : "Room camera"}</h3>
            <p>{savedCamera ? "Review the camera name, placement, or room map." : "Connect a camera to begin receiving home observations."}</p>
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
                ? "This camera is already paired to the household. You can finish its name, placement, or room context without creating a new code."
                : "Share this one-time code with the camera device. As soon as it is accepted, the camera is saved; room mapping can be finished now or later."}
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
              <span className={cameraMapReady ? "complete" : cameraSetupSaved ? "current" : ""}>
                3 <b>Room context</b>
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
                <Link className="secondary-button" to={`/join/${pairing.code}`} onClick={rememberDashboardSession}>
                  Open camera setup on this computer <ChevronRight size={15} />
                </Link>
                <span className="muted">For another device, open this website&apos;s /join page there and enter the code.</span>
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
                {resumedCamera && getCameraReconnect(resumedCamera.id) && (
                  <Link className="secondary-button" to={`/camera/${encodeURIComponent(resumedCamera.id)}`} onClick={rememberDashboardSession}>
                    Reconnect this computer as {resumedCamera.label}
                  </Link>
                )}
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
                      <span className="pairing-setup-icon" aria-hidden="true"><Map size={17} /></span>
                      <div>
                        <span className="eyebrow">ROOM CONTEXT · OPTIONAL</span>
                        <h3>{cameraMapTitle}</h3>
                        <p>{cameraMapDescription}</p>
                      </div>
                    </div>
                    <div className={`room-sweep-status ${cameraMapReady ? "ready" : ["needs_rescan", "unavailable", "failed"].includes(mapGenerationStatus ?? "") ? "failed" : "processing"}`} role="status">
                      <span className="status-dot" />
                      <span><strong>{cameraMapReady ? "Room context is ready" : mapGenerationStatus === "collecting" ? "Walkthrough is ready to record" : mapGenerationStatus === "processing" ? "Building the room draft" : mapGenerationStatus ? mapGenerationStatus.replace("_", " ") : "No room walkthrough yet"}</strong><small>{cameraMapReady ? "Relative visual geometry · no measured scale" : mapGenerationQuery.data?.error ?? "The camera remains saved whether or not you create a map."}</small></span>
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
          <h3>{hasCheckIn ? "A check-in is recorded." : "Waiting for today’s check-in."}</h3>
          <p>{checkInEvent ? checkInEvent.detail : todayQuestion ? "Today's questions are available for review in Questions & Signals." : `${residentName} has no recorded check-in yet today. ONE will keep the result in context with the personal baseline when it arrives.`}</p>
        </div>
        <div className="plan-status">
          <strong>{hasCheckIn ? "Done" : "—"}</strong>
          <span>{hasCheckIn ? "human signal" : "not recorded"}</span>
          <div className="progress-line">
            <span style={{ width: hasCheckIn ? "100%" : "12%" }} />
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
