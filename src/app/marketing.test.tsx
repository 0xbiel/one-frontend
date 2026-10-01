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

  it("opens the product submenu on hover and closes it when the pointer leaves", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const view = renderAt("/products/exterior");
    const productMenu = view.container.querySelector(".one-site-nav-products");
    const productSubmenu = view.container.querySelector("#one-site-product-subnav");
    expect(productMenu).toBeInTheDocument();
    expect(productSubmenu).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerEnter(productMenu!, { pointerType: "mouse" });
    const productPages = screen.getByRole("group", { name: "Product pages" });
    expect(productPages.querySelectorAll("a")).toHaveLength(4);
    expect(productPages.querySelector('a[href="/products/hub"]')).toHaveTextContent("ONE Hub");
    expect(screen.getByRole("link", { name: "Wall Camera" })).toHaveAttribute("aria-current", "page");

    fireEvent.pointerLeave(productMenu!, { pointerType: "mouse" });
    expect(productSubmenu).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("group", { name: "Product pages" })).not.toBeInTheDocument();
  });

  it("lets touch and keyboard users open the product submenu", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const view = renderAt("/");
    const productSubmenu = view.container.querySelector("#one-site-product-subnav");

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Show product pages" }));
    expect(productSubmenu).toHaveAttribute("aria-hidden", "false");
    fireEvent.click(screen.getByRole("button", { name: "Hide product pages" }));
    expect(productSubmenu).toHaveAttribute("aria-hidden", "true");

    fireEvent.focus(screen.getByRole("link", { name: "Products" }));
    expect(productSubmenu).toHaveAttribute("aria-hidden", "false");
  });

  it.each([
    ["/products/camera", "Standing Camera", "/product-assets/camera-anatomy/standing-exploded.webp", "standing-front-panel.webp"],
    ["/products/exterior", "Wall Camera", "/product-assets/camera-anatomy/wall-exploded.webp", "wall-front-panel.webp"],
  ])("shows one animated camera component at a time for %s", (path, cameraName, explodedImage, firstPartImage) => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt(path);

    expect(screen.getByRole("heading", { name: cameraName })).toBeInTheDocument();
    expect(screen.getByText(/Final design, specifications, and availability are not confirmed/)).toBeInTheDocument();
    const track = document.querySelector(".one-product-anatomy-track");
    const explodedView = document.querySelector(`.one-product-anatomy-overview img[src="${explodedImage}"]`);
    expect(explodedView).toBeInTheDocument();
    expect(track?.compareDocumentPosition(explodedView!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const anatomy = explodedView?.closest(".one-product-anatomy");
    expect(anatomy?.nextElementSibling).toHaveClass("one-camera-parts-note");
    expect(anatomy?.nextElementSibling?.nextElementSibling).toHaveClass("one-site-product-neighbors");
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

  it.each([
    ["/products/hub", [], ["/products/camera"]],
    ["/products/camera", ["/products/hub"], ["/products/exterior"]],
    ["/products/exterior", ["/products/camera"], ["/products/family"]],
    ["/products/family", ["/products/exterior"], []],
  ])("shows contextual product links on %s", (path, previous, next) => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt(path);
    const nav = screen.getByRole("navigation", { name: "Explore nearby products" });
    const links = [...nav.querySelectorAll("a")].map(link => link.getAttribute("href"));
    expect(links).toEqual([...previous, ...next]);
  });

  it("shows sample map demonstrations on Technology", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/technology");

    expect(screen.getByRole("heading", { name: "Explore a sample home map" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow a sample route" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Illustrative animated route from Home to Shop" })).toBeInTheDocument();
    expect(document.querySelector(".one-tech-route-path")).toHaveAttribute("d", "M92 318H464V200H650V82");
    expect(document.querySelectorAll(".one-tech-map-2d rect")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "Home map view" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    expect(screen.getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: /Illustrative floor plan/ })).toBeInTheDocument();
  });

  it("shows locally interactive, plain-language sample check-ins on Technology", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/technology");
    fireEvent.click(screen.getByRole("button", { name: "I feel worried" }));
    expect(screen.getByText(/This sample cannot contact anyone or assess an emergency/)).toBeInTheDocument();
    expect(screen.getByText("Sample only · not a live chat or medical service")).toBeInTheDocument();
    expect(document.querySelector(".one-tech-demo-hint")).not.toBeInTheDocument();
  });

  it("makes the home page a working preview of map, check-in, and products", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/");
    expect(screen.getByRole("heading", { name: "Care, closer to home." })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Explore/ }).length).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByRole("tab", { name: "Check-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Who can see this?" }));
    expect(screen.getByText(/People with access to this home/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Home map" }));
    fireEvent.click(screen.getByRole("button", { name: "Kitchen" }));
    expect(screen.getAllByText("Kitchen")).toHaveLength(2);
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

  it("provides account and household guides with working destinations", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderAt("/support");
    expect(document.querySelector(".one-site-support-topic-grid")?.children).toHaveLength(9);

    fireEvent.change(screen.getByRole("textbox", { name: "Search support guides" }), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Search support guides" }));
    expect(screen.getByRole("heading", { name: "Sign in with an email code" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open sign in" })).toHaveAttribute("href", "/login");

    fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
    fireEvent.click(screen.getByRole("button", { name: /Create a care space/ }));
    expect(screen.getByRole("link", { name: "Create a care space" })).toHaveAttribute("href", "/create-account");

    fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
    fireEvent.click(screen.getByRole("button", { name: /Join a household invitation/ }));
    expect(screen.getByRole("link", { name: "Join a household" })).toHaveAttribute("href", "/join-household");
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
    const view = render(<MemoryRouter initialEntries={["/app"]}><AppDownloadPage /></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: "Legal documents" })).toBeInTheDocument();
    const mainNavigation = view.container.querySelector(".one-site-header-main .one-site-nav");
    expect(mainNavigation?.querySelectorAll("a")).toHaveLength(10);
    expect(mainNavigation?.querySelector("a.active")).toHaveTextContent("ONE app");
  });

  it("lets visitors explore a clearly labeled, interactive app sample", () => {
    render(<MemoryRouter initialEntries={["/app"]}><AppDownloadPage /></MemoryRouter>);

    expect(screen.getByLabelText("Interactive ONE app sample")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Care overview" })).toBeInTheDocument();
    expect(screen.queryByText(/Pedro|Alex|Jamie/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Map" }));
    expect(screen.getByRole("tabpanel").querySelector("h2")).toHaveTextContent("Home map");
    fireEvent.click(screen.getByRole("button", { name: "Bedroom" }));
    expect(screen.getByRole("button", { name: "Bedroom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Illustrative room · no live location")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Check-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Okay" }));
    fireEvent.click(screen.getByRole("button", { name: /Save sample answer/ }));
    expect(screen.getByRole("button", { name: /Sample answer saved/ })).toBeInTheDocument();
    expect(screen.getByText("This demo stays on this page and is not sent to ONE.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: /Cameras/ }));
    expect(screen.getByRole("heading", { name: "Cameras" })).toBeInTheDocument();
  });
});
