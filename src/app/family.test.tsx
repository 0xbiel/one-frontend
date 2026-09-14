import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FamilyPage } from "./family";

describe("Family access management", () => {
  afterEach(() => { vi.restoreAllMocks(); sessionStorage.removeItem("one_care_recipient_id"); });

  it("adds, edits, selects, and removes people receiving care separately from access", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><FamilyPage /></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(screen.getByText("People you care for")).toBeInTheDocument());
    expect(screen.getByText(/do not receive an account or access/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^add person$/i }));
    const createDialog = screen.getByRole("dialog", { name: /add person receiving care/i });
    fireEvent.change(within(createDialog).getByLabelText(/^name$/i), { target: { value: "Elena Navarro" } });
    fireEvent.change(within(createDialog).getByLabelText(/relationship or context/i), { target: { value: "Resident" } });
    fireEvent.change(within(createDialog).getByLabelText(/room or label/i), { target: { value: "Room 204" } });
    fireEvent.click(within(createDialog).getByRole("button", { name: /^add person/i }));
    await waitFor(() => expect(screen.getByText("Elena Navarro")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /edit elena navarro/i }));
    const editDialog = screen.getByRole("dialog", { name: /edit person receiving care/i });
    fireEvent.change(within(editDialog).getByLabelText(/^name$/i), { target: { value: "Elena Soler" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(screen.getByText("Elena Soler")).toBeInTheDocument());

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /remove elena soler/i }));
    await waitFor(() => expect(screen.queryByText("Elena Soler")).not.toBeInTheDocument());
  });

  it("protects admin access and supports demo role edits and removal", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><FamilyPage /></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(screen.getByText("People with access")).toBeInTheDocument());
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
