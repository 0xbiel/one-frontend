import { useEffect, useState } from "react";
import type { CameraLocalizationHistoryResponse } from "../api/client";

function meters(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value < 1 ? `${Math.round(value * 100)} cm` : `${value.toFixed(2)} m`;
}

function shortTime(value: string | null | undefined): string {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function LocalizationTemporalTrace({
  history,
  loading,
  savingReference = false,
  onSetReference,
}: {
  history?: CameraLocalizationHistoryResponse;
  loading: boolean;
  savingReference?: boolean;
  onSetReference?: (point: { x: number; z: number }) => Promise<void>;
}) {
  const attempts = history?.attempts ?? [];
  const physicalReference = history?.ground_truth_reference ?? (history?.reference?.kind === "ground-truth-floor" ? history.reference : null);
  const physicalPosition = physicalReference?.floor_position;
  const [referenceX, setReferenceX] = useState("");
  const [referenceZ, setReferenceZ] = useState("");
  const [referenceError, setReferenceError] = useState("");
  useEffect(() => {
    if (physicalPosition?.length === 2) {
      setReferenceX(Number(physicalPosition[0]).toFixed(3));
      setReferenceZ(Number(physicalPosition[1]).toFixed(3));
    }
  }, [physicalPosition?.[0], physicalPosition?.[1]]);
  const plotted = attempts.filter((attempt) => typeof attempt.selected_distance_to_reference_m === "number");
  const latest = attempts.at(-1);
  const latestCandidates = latest?.candidates.slice(0, 5) ?? [];
  const maxDistance = Math.max(0.25, ...plotted.map((attempt) => attempt.selected_distance_to_reference_m ?? 0));
  const firstDistance = plotted[0]?.selected_distance_to_reference_m;
  const latestDistance = plotted.at(-1)?.selected_distance_to_reference_m;
  const improvement = typeof firstDistance === "number" && typeof latestDistance === "number" ? firstDistance - latestDistance : null;
  const chartWidth = 300;
  const chartHeight = 104;
  const padX = 16;
  const padY = 12;
  const chartPoints = plotted.map((attempt, index) => {
    const x = plotted.length <= 1 ? chartWidth / 2 : padX + (index / (plotted.length - 1)) * (chartWidth - padX * 2);
    const value = attempt.selected_distance_to_reference_m ?? 0;
    const y = chartHeight - padY - (value / maxDistance) * (chartHeight - padY * 2);
    return { x, y, attempt };
  });
  const path = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const usesGroundTruth = history?.distance_metric === "horizontal-floor" || physicalReference?.kind === "ground-truth-floor";
  const spatialAttempts = attempts.filter((attempt) => {
    const center = attempt.selected_camera_center;
    return Array.isArray(center) && center.length >= 3 && Number.isFinite(center[0]) && Number.isFinite(center[2]);
  });
  const referenceXZ = physicalPosition?.length === 2
    ? [Number(physicalPosition[0]), Number(physicalPosition[1])]
    : history?.reference?.camera_center?.length === 3
      ? [Number(history.reference.camera_center[0]), Number(history.reference.camera_center[2])]
      : null;
  const spatialWidth = 300;
  const spatialHeight = 154;
  const spatialPad = 24;
  const spatialSamples = [
    ...spatialAttempts.map((attempt) => [Number(attempt.selected_camera_center![0]), Number(attempt.selected_camera_center![2])]),
    ...(referenceXZ ? [referenceXZ] : []),
  ];
  const rawMinX = spatialSamples.length ? Math.min(...spatialSamples.map(([x]) => x)) : -1;
  const rawMaxX = spatialSamples.length ? Math.max(...spatialSamples.map(([x]) => x)) : 1;
  const rawMinZ = spatialSamples.length ? Math.min(...spatialSamples.map(([, z]) => z)) : -1;
  const rawMaxZ = spatialSamples.length ? Math.max(...spatialSamples.map(([, z]) => z)) : 1;
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerZ = (rawMinZ + rawMaxZ) / 2;
  const spanX = Math.max(1.2, rawMaxX - rawMinX) * 1.18;
  const spanZ = Math.max(1.2, rawMaxZ - rawMinZ) * 1.18;
  const minX = centerX - spanX / 2;
  const maxX = centerX + spanX / 2;
  const minZ = centerZ - spanZ / 2;
  const maxZ = centerZ + spanZ / 2;
  const projectXZ = ([x, z]: number[]) => ({
    x: spatialPad + ((x - minX) / Math.max(0.001, maxX - minX)) * (spatialWidth - spatialPad * 2),
    y: spatialHeight - spatialPad - ((z - minZ) / Math.max(0.001, maxZ - minZ)) * (spatialHeight - spatialPad * 2),
  });
  const spatialPoints = spatialAttempts.map((attempt) => ({
    ...projectXZ([Number(attempt.selected_camera_center![0]), Number(attempt.selected_camera_center![2])]),
    attempt,
  }));
  const spatialPath = spatialPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const targetPoint = referenceXZ ? projectXZ(referenceXZ) : null;

  const saveReference = async () => {
    if (!onSetReference) return;
    const x = Number(referenceX);
    const z = Number(referenceZ);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      setReferenceError("Enter finite RoomPlan X and Z coordinates.");
      return;
    }
    setReferenceError("");
    try {
      await onSetReference({ x, z });
    } catch {
      setReferenceError("The physical reference could not be saved.");
    }
  };

  return (
    <div className="panel localization-trace-card">
      <div className="localization-trace-heading">
        <div>
          <span className="eyebrow">LOCALIZATION TRACE</span>
          <h3>Where the camera thinks it is</h3>
        </div>
        <span className="localization-live-chip">LIVE · 2 S</span>
      </div>
      <p className="muted small-copy">Each localization attempt is kept as numeric pose diagnostics only. Raw camera frames are not added to this trace.</p>

      <div className="localization-reference-editor">
        <div>
          <span className="eyebrow">PHYSICAL FLOOR TARGET</span>
          <p>{usesGroundTruth ? "Error is measured horizontally to this verified RoomPlan point." : "Set the real camera point to turn the trace into true floor-position error."}</p>
        </div>
        <div className="localization-reference-fields">
          <label>X (m)<input inputMode="decimal" value={referenceX} onChange={(event) => setReferenceX(event.target.value)} placeholder="0.000" /></label>
          <label>Z (m)<input inputMode="decimal" value={referenceZ} onChange={(event) => setReferenceZ(event.target.value)} placeholder="0.000" /></label>
          <button className="secondary-button" disabled={!onSetReference || savingReference} onClick={() => void saveReference()}>{savingReference ? "Saving…" : "Save target"}</button>
        </div>
        {referenceError ? <small className="localization-reference-error">{referenceError}</small> : null}
      </div>

      {loading && !attempts.length ? <p className="localization-empty">Loading pose history…</p> : null}
      {!loading && !attempts.length ? <p className="localization-empty">No localization attempts yet. The trace will populate as the fixed camera retries.</p> : null}

      {attempts.length ? (
        <>
          <div className="localization-metrics">
            <div><span>Attempts</span><strong>{attempts.length}</strong></div>
            <div><span>{usesGroundTruth ? "Latest floor error" : "Latest delta"}</span><strong>{meters(latestDistance)}</strong></div>
            <div><span>Change</span><strong>{improvement === null ? "—" : improvement >= 0 ? `−${meters(improvement)}` : `+${meters(Math.abs(improvement))}`}</strong></div>
          </div>

          {history?.reference ? (
            <div className="localization-chart-wrap" aria-label={usesGroundTruth ? "Horizontal distance from selected pose to physical camera reference over time" : "Distance from selected pose to latest accepted camera reference over time"}>
              <div className="localization-chart-scale"><span>{meters(maxDistance)}</span><span>0 m</span></div>
              <svg className="localization-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Localization distance over time">
                <line x1={padX} y1={chartHeight - padY} x2={chartWidth - padX} y2={chartHeight - padY} />
                {path ? <path d={path} /> : null}
                {chartPoints.map(({ x, y, attempt }) => (
                  <circle key={attempt.id} cx={x} cy={y} r="4" className={attempt.status === "positioned" ? "accepted" : "candidate"}>
                    <title>{`${shortTime(attempt.created_at)} · ${meters(attempt.selected_distance_to_reference_m)}`}</title>
                  </circle>
                ))}
              </svg>
            </div>
          ) : (
            <p className="localization-reference-note">Candidate positions are being recorded. Save the physical floor target above to measure real localization error in metres.</p>
          )}

          {spatialPoints.length ? (
            <div className="localization-spatial-wrap">
              <div className="localization-spatial-head">
                <div>
                  <span className="eyebrow">ROOMPLAN X / Z</span>
                  <strong>Pose trajectory</strong>
                </div>
                <div className="localization-spatial-legend">
                  <span className="semantic">semantic</span><span className="visual">PnP</span><span className="temporal">held prior</span>{targetPoint ? <span className="target">target</span> : null}
                </div>
              </div>
              <svg className="localization-spatial-chart" viewBox={`0 0 ${spatialWidth} ${spatialHeight}`} role="img" aria-label="Top-down RoomPlan camera position estimates over time">
                <line className="axis" x1={spatialPad} y1={spatialHeight - spatialPad} x2={spatialWidth - spatialPad} y2={spatialHeight - spatialPad} />
                <line className="axis" x1={spatialPad} y1={spatialPad} x2={spatialPad} y2={spatialHeight - spatialPad} />
                <text x={spatialWidth - spatialPad} y={spatialHeight - 7} textAnchor="end">X {maxX.toFixed(1)} m</text>
                <text x={spatialPad} y={13}>Z {maxZ.toFixed(1)} m</text>
                {spatialPath ? <path className="trajectory" d={spatialPath} /> : null}
                {spatialPoints.map(({ x, y, attempt }, index) => (
                  <circle
                    key={attempt.id}
                    cx={x}
                    cy={y}
                    r={index === spatialPoints.length - 1 ? 5 : 3.5}
                    className={`estimate ${attempt.selected_estimate_source === "semantic-cuboid" ? "semantic" : attempt.selected_estimate_source === "temporal-prior" ? "temporal" : "visual"}`}
                  >
                    <title>{`${shortTime(attempt.created_at)} · X ${attempt.selected_camera_center?.[0]?.toFixed(3)} · Z ${attempt.selected_camera_center?.[2]?.toFixed(3)} · ${meters(attempt.selected_distance_to_reference_m)}`}</title>
                  </circle>
                ))}
                {targetPoint ? (
                  <g className="target-marker">
                    <circle cx={targetPoint.x} cy={targetPoint.y} r="6" />
                    <line x1={targetPoint.x - 9} y1={targetPoint.y} x2={targetPoint.x + 9} y2={targetPoint.y} />
                    <line x1={targetPoint.x} y1={targetPoint.y - 9} x2={targetPoint.x} y2={targetPoint.y + 9} />
                  </g>
                ) : null}
              </svg>
              <small>Older → newer along the trace. The final point is enlarged.</small>
            </div>
          ) : null}

          {latest ? (
            <div className="localization-latest">
              <div className="localization-latest-head">
                <span>Latest · {shortTime(latest.created_at)}</span>
                <strong className={latest.status === "positioned" ? "is-positioned" : "is-searching"}>{latest.status === "positioned" ? "positioned" : "searching"}</strong>
              </div>
              <div className="localization-latest-meta">
                <span>{latest.selected_estimate_source === "semantic-cuboid" ? "semantic cuboid estimate" : latest.selected_estimate_source === "temporal-prior" ? "held stable prior · fresh solve rejected" : "visual PnP estimate"}</span>
                {latest.selected_camera_center?.length === 3 ? <span>X {latest.selected_camera_center[0].toFixed(3)} · Z {latest.selected_camera_center[2].toFixed(3)}</span> : null}
                <span>{latest.inlier_count}/{latest.match_count} inliers</span>
                <span>{typeof latest.reprojection_error_px === "number" ? `${latest.reprojection_error_px.toFixed(2)} px reprojection` : "reprojection —"}</span>
                <span>{typeof latest.confidence === "number" ? `${Math.round(latest.confidence * 100)}% confidence` : "confidence —"}</span>
              </div>
              {latestCandidates.length ? (
                <div className="localization-candidates">
                  {latestCandidates.map((candidate, index) => (
                    <div key={`${candidate.frame_index ?? "f"}-${candidate.landmark_view_id ?? "v"}-${index}`} className={candidate.scene_plausible ? "" : "rejected"}>
                      <span>#{index + 1} · {candidate.kind === "semantic-cuboid" ? "cuboid" : "PnP"} · frame {candidate.frame_index ?? "—"}</span>
                      <strong>{meters(candidate.distance_to_reference_m)}</strong>
                      <small>
                        {candidate.kind === "semantic-cuboid"
                          ? `${candidate.matched_object_count ?? candidate.match_count} objects · ${candidate.semantic_group_count ?? 0} groups · ${typeof candidate.mean_iou === "number" ? `${Math.round(candidate.mean_iou * 100)}% mean IoU` : "IoU —"}${typeof candidate.minimum_iou === "number" ? ` · ${Math.round(candidate.minimum_iou * 100)}% min` : ""}`
                          : `${candidate.inlier_count} inliers · ${candidate.consensus_scan_view_count} scan views`}
                      </small>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
