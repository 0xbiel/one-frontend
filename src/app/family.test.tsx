import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FamilyPage } from "./family";

describe("Family access management", () => {
  afterEach(() => vi.restoreAllMocks());

  it("protects admin access and supports demo role edits and removal", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><FamilyPage /></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(screen.getByText("People with a view")).toBeInTheDocument());
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit role for clara/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit role for jordi/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /role for jordi/i }), { target: { value: "resident" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    await waitFor(() => expect(screen.getByLabelText(/Jordi García, Viewer/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /reveal removal action for jordi/i }));
    expect(screen.getByRole("button", { name: /confirm remove access/i })).toBeInTheDocument();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /confirm remove access/i }));
    await waitFor(() => expect(screen.queryByLabelText(/Jordi García, Viewer/)).not.toBeInTheDocument());
  });
});
