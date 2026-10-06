import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MapFrame } from "./MapFrame";
afterEach(cleanup);
it("expands the actual existing map and returns on Escape", () => {
 render(<MapFrame><canvas aria-label="Map geometry" /></MapFrame>);
 const geometry = screen.getByLabelText("Map geometry");
 const expand = screen.getByRole("button", { name: "Expand map" });
 expect(expand).toHaveAttribute("aria-expanded", "false");
 fireEvent.click(expand);
 expect(screen.getByLabelText("Expanded home map")).toHaveClass("map-panel-expanded");
 expect(screen.getByLabelText("Map geometry")).toBe(geometry);
 fireEvent.keyDown(window, { key: "Escape" });
 expect(screen.getByRole("button", { name: "Expand map" })).toHaveAttribute("aria-expanded", "false");
 expect(screen.getByLabelText("Map geometry")).toBe(geometry);
});
