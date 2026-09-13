import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  ChevronRight,
  Copy,
  Map,
  MapPin,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { HomeEvent, LastSeenObject } from "../models/domain";
import { EventRow, ObjectCard } from "./shared";

type Pairing = { pairing_id: string; code: string; expires_at: string };

export function OverviewPage({
  events,
  objects,
  onEvent,
}: {
  events: HomeEvent[];
  objects: LastSeenObject[];
  onEvent: (event: HomeEvent) => void;
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
  const [cameraCalibrationStep, setCameraCalibrationStep] = useState(0);
  const [cameraCalibrationBusy, setCameraCalibrationBusy] = useState(false);
  const [cameraCalibrationSaved, setCameraCalibrationSaved] = useState(false);
  const pairingStatusQuery = useQuery({
    queryKey: ["pairing-status", pairing?.pairing_id],
    queryFn: () => api.getPairingStatus(pairing!.pairing_id),
    enabled: pairingOpen && Boolean(pairing?.pairing_id),
    refetchInterval: pairingOpen && pairing ? 3000 : false,
    retry: false,
  });
  const cameraConnected = pairingStatusQuery.data?.status === "connected";
  const pairingExpired = pairingStatusQuery.data?.status === "expired";

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
    setPairing(null);
    setPairingCopied(false);
    setCameraSetupSaved(false);
    setCameraCalibrationStep(0);
    setCameraCalibrationSaved(false);
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
    const cameraId = pairingStatusQuery.data?.device.id;
    if (cameraSetupBusy || !cameraId || !cameraLabel.trim()) return;
    setCameraSetupBusy(true);
    setPairingError("");
    try {
      await api.updateCamera(cameraId, {
        name: cameraLabel.trim(),
        metadata: { room: cameraRoom },
      });
      setCameraSetupSaved(true);
      setCameraCalibrationStep(0);
      setCameraCalibrationSaved(false);
      void query.invalidateQueries({ queryKey: ["camera"] });
    } catch {
      setPairingError(
        "We could not save this camera setup. Check the local connection and try again.",
      );
    } finally {
      setCameraSetupBusy(false);
    }
  };

  const confirmCalibrationAnchor = async () => {
    const cameraId = pairingStatusQuery.data?.device.id;
    if (cameraCalibrationBusy || !cameraId || !cameraSetupSaved) return;
    const nextStep = cameraCalibrationStep + 1;
    if (nextStep < 3) {
      setCameraCalibrationStep(nextStep);
      return;
    }
    setCameraCalibrationBusy(true);
    setPairingError("");
    try {
      const map = await api.createProvisionalMap(cameraId, cameraRoom);
      await api.createCalibration(cameraId, map.id, cameraRoom, ["left", "center", "right"]);
      setCameraCalibrationStep(3);
      setCameraCalibrationSaved(true);
      void query.invalidateQueries({ queryKey: ["camera"] });
      void query.invalidateQueries({ queryKey: ["current-map"] });
      void query.invalidateQueries({ queryKey: ["scene"] });
    } catch {
      setPairingError(
        "The camera is saved, but room calibration could not be recorded. Check the connection and try again.",
      );
    } finally {
      setCameraCalibrationBusy(false);
    }
  };

  return (
    <div className="home-page">
      <section className="home-intro">
        <span className="eyebrow">ONE · THE GARCÍA HOME</span>
        <h2>
          A little support.
          <br />A more independent day.
        </h2>
        <p>
          Stay close to what matters with gentle, explainable observations from
          home.
        </p>
      </section>

      <section className="pairing-card">
        <div>
          <span className="eyebrow">CAMERA CONNECTION</span>
          <h3>Bring one more set of eyes into the room.</h3>
          <p>
            Pair a phone or laptop camera in under a minute. Consent comes
            before anything is shared.
          </p>
        </div>
        <button className="primary-button" onClick={() => void openPairing()}>
          <Camera size={17} /> Pair a camera <ChevronRight size={16} />
        </button>
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
            <h2 id="camera-pairing-title">Connect a phone or laptop</h2>
            <p className="muted">
              Share this one-time code with the camera device. Keep this screen
              open while it connects; once it is accepted, its name and placement
              can be finished right here.
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
              <span className={cameraCalibrationSaved ? "complete" : cameraSetupSaved ? "current" : ""}>
                3 <b>Calibrate</b>
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
                    ? "Camera connected"
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
                    ? `${pairingStatusQuery.data?.device.label ?? "The device"} is linked. Finish its setup below.`
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
                  <span className="pairing-setup-icon" aria-hidden="true">
                    <MapPin size={17} />
                  </span>
                  <div>
                    <span className="eyebrow">FINISH SETUP HERE</span>
                    <h3>Make this camera easy to recognize.</h3>
                    <p>
                      Give it a clear name and familiar placement for the
                      household map.
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
                      setCameraCalibrationStep(0);
                      setCameraCalibrationSaved(false);
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
                      setCameraCalibrationStep(0);
                      setCameraCalibrationSaved(false);
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
                  <div className="pairing-calibration-panel">
                    <div className="pairing-setup-intro">
                      <span className="pairing-setup-icon" aria-hidden="true">
                        <Map size={17} />
                      </span>
                      <div>
                        <span className="eyebrow">ROOM CALIBRATION</span>
                        <h3>{cameraCalibrationSaved ? "Room calibration saved." : "Teach ONE this view."}</h3>
                        <p>
                          {cameraCalibrationSaved
                            ? "The camera and its three room anchors are ready for approximate location memory."
                            : "Keep the phone fixed and confirm three familiar anchors so observations can stay approximate."}
                        </p>
                      </div>
                    </div>
                    <div className="calibration-anchor-list" aria-label="Room calibration anchors">
                      {["Left anchor", "Center anchor", "Right anchor"].map((anchor, index) => (
                        <span
                          key={anchor}
                          className={index < cameraCalibrationStep ? "complete" : index === cameraCalibrationStep && !cameraCalibrationSaved ? "current" : ""}
                        >
                          <b>{index < cameraCalibrationStep ? <Check size={12} /> : index + 1}</b>
                          {anchor}
                        </span>
                      ))}
                    </div>
                    {cameraCalibrationSaved ? (
                      <div className="success-note" role="status">
                        <Check size={15} /> Calibration active · estimated error 0.18 m.
                      </div>
                    ) : (
                      <button
                        className="secondary-button full-width"
                        onClick={() => void confirmCalibrationAnchor()}
                        disabled={cameraCalibrationBusy}
                      >
                        {cameraCalibrationBusy
                          ? "Saving calibration…"
                          : cameraCalibrationStep === 0
                            ? "Start calibration"
                            : `Confirm ${["left", "center", "right"][cameraCalibrationStep]} anchor`} <ChevronRight size={16} />
                      </button>
                    )}
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
                disabled={pairingBusy || cameraConnected}
              >
                New code
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

      <div className="status-chips" aria-label="Home status filters">
        <button className="chip active">
          <span className="status-dot" /> All home
        </button>
        <button className="chip">Calm today</button>
        <button className="chip">3 observations</button>
        <button className="chip">Camera online</button>
      </div>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECENT OBSERVATIONS</span>
            <h3>Small moments, kept meaningful.</h3>
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
          <span className="eyebrow">HOUSEHOLD PLAN · TODAY</span>
          <h3>Morning check-in is complete.</h3>
          <p>
            María answered 4 of 4 prompts at 08:42. Her signal is within her
            personal baseline.
          </p>
        </div>
        <div className="plan-status">
          <strong>4 / 4</strong>
          <span>calm check-in</span>
          <div className="progress-line">
            <span />
          </div>
        </div>
        <button className="secondary-button" onClick={() => navigate("/dashboard/assistant")}>
          Explore context <ChevronRight size={16} />
        </button>
      </section>

      <section className="home-section memory-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">OBJECT MEMORY</span>
            <h3>Where things were last seen</h3>
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
