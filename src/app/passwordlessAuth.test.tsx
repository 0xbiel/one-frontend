import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { EmailChallenge, EmailSession } from "../api/client";

const challenge: EmailChallenge = {
  verification_id: "verification-1",
  expires_in_seconds: 600,
  delivery: "email",
  email: "alex@example.com",
  purpose: "login",
  home_id: "home-1",
  user_id: "user-1",
  role: "admin",
};

const session: EmailSession = {
  access_token: "session-token",
  token_type: "bearer",
  expires_in: 3600,
  home_id: "home-1",
  user_id: "user-1",
  email: "alex@example.com",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../api/client");
  vi.resetModules();
  sessionStorage.clear();
});

describe("passwordless account access", () => {
  it("signs in by checking a one-time code for the submitted email", async () => {
    const requestCode = vi.fn().mockResolvedValue(challenge);
    const verifyCode = vi.fn().mockResolvedValue(session);
    vi.doMock("../api/client", async () => {
      const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
      return { ...actual, demoMode: false, api: { ...actual.api, requestEmailCode: requestCode, verifyEmailCode: verifyCode } };
    });
    const { LoginPage } = await import("./login");
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByText(/We’ll email you a one-time code to sign in/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send sign-in code/i }));

    await waitFor(() => expect(requestCode).toHaveBeenCalledWith("login", "alex@example.com"));
    fireEvent.change(await screen.findByLabelText("One-time code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));
    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith("alex@example.com", "123456"));
  });

  it("creates an account by verifying an email code, without a password", async () => {
    const requestCode = vi.fn().mockResolvedValue({ ...challenge, purpose: "create" });
    const verifyCode = vi.fn().mockResolvedValue(session);
    vi.doMock("../api/client", () => ({ demoMode: false, api: { requestEmailCode: requestCode, verifyEmailCode: verifyCode } }));
    const { RegisterPage } = await import("./register");
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Alex Taylor" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    await waitFor(() => expect(requestCode).toHaveBeenCalledWith("create", "alex@example.com", "Alex Taylor", "", "home", "general"));
    fireEvent.change(await screen.findByLabelText("One-time code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /verify email and continue/i }));
    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith("alex@example.com", "654321"));
  });
});
