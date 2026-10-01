import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { QuestionsPage } from "./questions";

function renderQuestions() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><QuestionsPage recipientId="recipient-manuel" /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => sessionStorage.clear());

describe("Questions & Signals history", () => {
  it("previews 7-day and 30-day questions and expands the full history from the count arrow", async () => {
    renderQuestions();
    await screen.findByRole("heading", { name: "Questions & Signals" });

    fireEvent.click(screen.getByRole("button", { name: "7 Days" }));
    const showAllSevenDays = await screen.findByRole("button", { name: /Show all \d+ questions/ });
    expect(screen.getAllByRole("row")).toHaveLength(4);
    fireEvent.click(showAllSevenDays);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(4));
    expect(screen.getByRole("button", { name: "Show fewer questions" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "30 Days" }));
    const showAllThirtyDays = await screen.findByRole("button", { name: /Show all \d+ questions/ });
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    fireEvent.click(showAllThirtyDays);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(4));
  });
});
