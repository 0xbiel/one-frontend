import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DayStoryCard, DayStoryDetails } from "./DayStory";
import { visibleRelationship } from "./recipientContext";
import type { DayStory } from "../api/client";
const story: DayStory = { recipient: { id: "recipient", display_name: "Person" }, window: { start_at: "2026-10-01T00:00:00Z", end_at: "2026-10-01T12:00:00Z", timezone: "UTC", partial_day: true }, headline: "A recorded morning", summary: "A check-in is recorded; the rest of the day is uncertain.", synthetic: true, attention_items: [{ id: "event", title: "Check this signal", detail: "A stored event awaits review.", source_ids: ["event"], observed_at: null, severity: "review", synthetic: true }], routine: { status: "unknown", reason: "Comparable coverage is unavailable.", baseline_eligible: false }, coverage: { simple_label: "Sparse records", observation_count: 2, last_observed_at: null, missing_means: "Missing signals do not establish inactivity." }, facts: [{ text: "Two retained records", source_ids: ["obs-a"], times: [], synthetic: true }], limitations: ["No live capture is established."] };
afterEach(cleanup);
describe("Shared caregiver day story", () => {
 it("leads with meaning, review and uncertainty and discloses sources on demand", () => {
  render(<><DayStoryCard story={story} /><DayStoryDetails story={story} /></>);
  expect(screen.getByText("A recorded morning")).toBeInTheDocument();
  expect(screen.getByText("Check this signal")).toBeInTheDocument();
  expect(screen.getByText("Simulated data")).toBeInTheDocument();
  expect(screen.getByText("Comparable coverage is unavailable.")).toBeInTheDocument();
  const details = screen.getByText("Activity details").closest("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(screen.getByText("Activity details"));
  expect(details.open).toBe(true);
  expect(screen.queryByText("obs-a")).not.toBeInTheDocument();
  expect(screen.getByText("Two retained records")).toBeInTheDocument();
 });
 it("shows missing story without inventing a reassuring summary", () => {
  render(<DayStoryCard error />);
  expect(screen.getByRole("status")).toHaveTextContent("unavailable");
  expect(screen.queryByText("Simulated data")).not.toBeInTheDocument();
 });
 it("keeps fixture provenance out of relationship labels without a name branch", () => {
  expect(visibleRelationship("Fictional synthetic care recipient (fixture v1)")).toBeNull();
  expect(visibleRelationship("Mother")).toBe("Mother");
 });
});
