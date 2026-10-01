import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DemoCameraGallery } from "./DemoCameraGallery";
import { DemoHomeMap } from "./DemoHomeMap";
import { api } from "../api/client";

function renderDashboard(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

describe("shared dashboard demo", () => {
  it("scopes events to the selected person while retaining separate household activity", async () => {
    renderDashboard("/dashboard/events");
    expect(await screen.findByText("Morning check-in complete")).toBeInTheDocument();
    expect(screen.getByText("Keys last seen")).toBeInTheDocument();
    const switcher = screen.getByRole("button", { name: "Care recipient", hidden: true });
    await waitFor(() => expect(switcher).toHaveTextContent("María García"));
    fireEvent.click(switcher);
    fireEvent.click(await screen.findByRole("option", { name: /Manuel García/, hidden: true }));
    await waitFor(() => expect(switcher).toHaveTextContent("Manuel García"));
    expect(sessionStorage.getItem("one_care_recipient_id")).toBe("recipient-manuel");
    expect((await api.getEvents("recipient-manuel")).map((event) => event.id)).not.toContain("evt-checkin");
    await waitFor(() => expect(screen.queryByText("Morning check-in complete")).not.toBeInTheDocument());
    expect(screen.getByText("Keys last seen")).toBeInTheDocument();
    expect(screen.getByText("Person observed")).toBeInTheDocument();
    expect(screen.getByText(/Household activity/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Objects" }));
    expect(screen.getByText("Keys last seen")).toBeInTheDocument();
    expect(screen.queryByText("Person observed")).not.toBeInTheDocument();
  });

  it("uses static sample camera images without requesting media permissions", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    render(<DemoCameraGallery />);
    fireEvent.click(screen.getByRole("button", { name: /Kitchen camera/ }));
    expect(screen.getByRole("img", { name: /sample view of the kitchen/i })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("switches map views and selects a room in the sample floor plan", async () => {
    render(<DemoHomeMap />);
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Bedroom" }));
    expect(screen.getByRole("heading", { name: "Bedroom" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Interactive sample 2D floor plan/ })).toBeInTheDocument();
  });
});
