import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingSite } from "./marketing";
import { AppDownloadPage } from "./appDownload";

afterEach(() => vi.restoreAllMocks());

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><MarketingSite /></MemoryRouter>);
}

describe("marketing navigation and controls", () => {
  it("keeps the footer focused on legal documents", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/products");

    const footer = screen.getByRole("navigation", { name: "Legal documents" });
    expect(footer).toHaveTextContent("Privacy notice");
    expect(footer).toHaveTextContent("Terms of use");
    expect(footer.querySelectorAll("a")).toHaveLength(2);
    expect(footer).not.toHaveTextContent(/English|Español/);
    expect(footer.querySelector('a[href="/products"]')).not.toBeInTheDocument();
    expect(footer.querySelector('a[href="/login"]')).not.toBeInTheDocument();
    expect(footer.querySelector('a[href="/legal/privacy-notice.html#privacy"]')).toBeInTheDocument();
    expect(document.querySelector(".one-site-product-tabs")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /design variants/i })).not.toBeInTheDocument();
  });

  it("shows all four products without carousel controls", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/products");
    const grid = document.querySelector(".one-site-card-grid");
    expect(grid?.children).toHaveLength(4);
    expect(grid?.querySelector(".one-site-card-hub")).toBeInTheDocument();
    expect(grid?.querySelector(".one-site-card-camera")).toBeInTheDocument();
    expect(grid?.querySelector(".one-site-card-exterior")).toBeInTheDocument();
    expect(grid?.querySelector(".one-site-card-family")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous product" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next product" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Choose a product" })).not.toBeInTheDocument();
  });

  it.each([
    ["/products/camera", "Standing Camera", "/product-assets/camera-anatomy/standing-exploded.webp", "standing-front-panel.webp"],
    ["/products/exterior", "Wall Camera", "/product-assets/camera-anatomy/wall-exploded.webp", "wall-front-panel.webp"],
  ])("shows one animated camera component at a time for %s", (path, cameraName, explodedImage, firstPartImage) => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt(path);

    expect(screen.getByRole("heading", { name: cameraName })).toBeInTheDocument();
    expect(screen.getByText(/Final design, specifications, and availability are not confirmed/)).toBeInTheDocument();
    expect(document.querySelector(`.one-product-anatomy-overview img[src="${explodedImage}"]`)).toBeInTheDocument();
    expect(document.querySelector(`.one-product-anatomy-visual img[src="/product-assets/camera-anatomy/${firstPartImage}"]`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inside the concept" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Front panel");
    fireEvent.click(screen.getByRole("button", { name: "Next component" }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Lens elements");
    expect(document.querySelectorAll(".one-product-anatomy-visual img")).toHaveLength(1);
  });

  it("shows the Hub concept exploded render and its component sequence", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/products/hub");

    expect(document.querySelector('.one-product-anatomy-overview img[src="/product-assets/hub-internals-v3.png"]')).toBeInTheDocument();
    expect(document.querySelector('.one-product-anatomy-visual img[src="/product-assets/hub-anatomy/display.webp"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next component" }));
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Inner chassis");
  });

  it("shows sample map demonstrations on Technology", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/technology");

    expect(screen.getByRole("heading", { name: "Explore a 3D home map" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow a sample route" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Illustrative animated route from Home to Shop" })).toBeInTheDocument();
  });

  it("opens the selected support guide from search", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/support");
    fireEvent.change(screen.getByRole("textbox", { name: "Search support guides" }), { target: { value: "six-digit pairing code" } });
    fireEvent.click(screen.getByRole("button", { name: "Search support guides" }));

    expect(await screen.findByRole("heading", { name: "Pair a camera" })).toBeInTheDocument();
    expect(screen.getByText("Enter the six-digit pairing code shown on the camera device.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open camera manager" })).toHaveAttribute("href", "/dashboard/cameras");
    fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
    expect(screen.queryByRole("heading", { name: "Pair a camera" })).not.toBeInTheDocument();
  });

  it("opens a selected privacy guide at the matching app settings", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/support");
    fireEvent.click(screen.getByRole("button", { name: /Manage camera privacy/ }));

    expect(screen.getByRole("heading", { name: "Manage camera privacy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open privacy settings" })).toHaveAttribute("href", "/dashboard/privacy");
  });

  it("changes the how-it-works explanation when a step is selected", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/how-it-works");
    fireEvent.click(screen.getByRole("button", { name: /connect cameras and assign rooms/i }));
    expect(screen.getByRole("heading", { name: "Connect cameras and assign rooms" })).toBeInTheDocument();
    expect(screen.getByText(/Hub images on this site are hardware concepts/)).toBeInTheDocument();
    expect(document.querySelector(".one-how-chart")).toHaveClass("is-visible");
  });

  it.each(["/", "/products/hub", "/products/camera", "/products/exterior", "/how-it-works", "/technology", "/support"])("shows legal links on %s", path => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt(path);
    expect(screen.getByRole("navigation", { name: "Legal documents" })).toBeInTheDocument();
  });

  it("shows legal links on the ONE app page", () => {
    render(<MemoryRouter initialEntries={["/app"]}><AppDownloadPage /></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: "Legal documents" })).toBeInTheDocument();
  });
});
