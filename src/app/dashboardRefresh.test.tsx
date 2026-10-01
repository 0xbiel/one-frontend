import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DemoCameraGallery } from "./DemoCameraGallery";
import { DemoHomeMap } from "./DemoHomeMap";
import { api } from "../api/client";

function renderDashboard(path: string) {
  sessionStorage.setItem("one_dashboard_access", "garcia-family");
  sessionStorage.setItem("one_access_token", "demo");
  sessionStorage.setItem("one_home_id", "home-demo");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

describe("shared dashboard demo", () => {
  it("scopes events to the selected person while retaining separate household activity", async () => {
    const mariaEventCount = (await api.getEvents("recipient-maria")).length;
    const manuelEventCount = (await api.getEvents("recipient-manuel")).length;
    renderDashboard("/dashboard/events");
    await waitFor(() => expect(screen.getByText("María answered four familiar morning prompts.")).toBeInTheDocument());
    await waitFor(() => expect(document.querySelector(".nav-badge")).toHaveAttribute("aria-label", `${mariaEventCount} events`));
    expect(screen.getAllByText("Keys last seen").length).toBeGreaterThan(0);
    const switcher = screen.getByRole("button", { name: "Care recipient", hidden: true });
    await waitFor(() => expect(switcher).toHaveTextContent("María García"));
    fireEvent.click(switcher);
    fireEvent.click(await screen.findByRole("option", { name: /Manuel García/, hidden: true }));
    await waitFor(() => expect(switcher).toHaveTextContent("Manuel García"));
    expect(sessionStorage.getItem("one_care_recipient_id")).toBe("recipient-manuel");
    expect((await api.getEvents("recipient-manuel")).map((event) => event.id)).not.toContain("evt-checkin");
    await waitFor(() => expect(screen.getAllByText(/Manuel completed/).length).toBeGreaterThan(0));
    await waitFor(() => expect(document.querySelector(".nav-badge")).toHaveAttribute("aria-label", `${manuelEventCount} events`));
    expect(screen.queryAllByText("María answered four familiar morning prompts.")).toHaveLength(0);
    expect(screen.getAllByText("Keys last seen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Person observed").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Household activity/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Objects" }));
    expect(screen.getAllByText("Keys last seen").length).toBeGreaterThan(0);
    expect(screen.queryByText("Person observed")).not.toBeInTheDocument();
  });

  it("uses static sample camera images without requesting media permissions", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    render(<DemoCameraGallery />);
    fireEvent.click(screen.getByRole("button", { name: /Kitchen camera/ }));
    expect(screen.getByRole("img", { name: /view of the kitchen/i })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("switches map views and selects a room in the sample floor plan", async () => {
    render(<DemoHomeMap />);
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Bedroom" }));
    expect(document.querySelector(".sample-map-toolbar h3")).toHaveTextContent("Bedroom");
    expect(screen.getByText("Manuel García, Reading glasses located here.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Interactive 2D floor plan/ })).toBeInTheDocument();
  });
});
