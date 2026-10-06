import { useEffect, useState, type ReactNode } from "react";
export function MapFrame({ children }: { children: ReactNode }) {
 const [expanded, setExpanded] = useState(false);
 useEffect(() => {
  const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
  window.addEventListener("keydown", escape);
  return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", escape); };
 }, [expanded]);
 return <section className={`map-panel panel${expanded ? " map-panel-expanded" : ""}`} aria-label={expanded ? "Expanded home map" : "Home map viewer"}><button className="secondary-button map-expand-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Close expanded map" : "Expand map"}</button>{children}</section>;
}
