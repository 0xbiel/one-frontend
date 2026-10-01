import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

function renderAt(path: string, signedIn = path !== '/login') {
  sessionStorage.clear();
  localStorage.clear();
  if (signedIn) {
    sessionStorage.setItem('one_dashboard_access', 'garcia-family');
    sessionStorage.setItem('one_access_token', 'demo');
    sessionStorage.setItem('one_home_id', 'home-demo');
    sessionStorage.setItem('one_care_recipient_id', 'recipient-maria');
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

describe('ONE web routes', () => {
  it('shows the current demo overview and pause control', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Your Home, in view' })).toBeInTheDocument();
    expect(screen.getByText('Recent observations')).toBeInTheDocument();
    expect(screen.getByText('3 recent observations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pause care/i }));
    expect(screen.getByText('Care is paused')).toBeInTheDocument();
  });

  it('shows the current login and registration entry', async () => {
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: /Care,\s*made closer/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create a care space/i })).not.toBeInTheDocument();
  });

  it('opens Manuel’s care space from the normal email-code sign-in', async () => {
    renderAt('/dashboard', false);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'garciafamily@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in code/i }));
    expect(await screen.findByLabelText('One-time code')).toHaveValue('482701');
    fireEvent.click(screen.getByRole('button', { name: /^sign in/i }));
    expect(await screen.findByRole('heading', { name: 'Your Home, in view' })).toBeInTheDocument();
    expect(sessionStorage.getItem('one_care_recipient_id')).toBe('recipient-manuel');
  });

  it('shows cameras in their dedicated dashboard page', async () => {
    renderAt('/dashboard/cameras');
    expect(await screen.findByRole('heading', { name: 'Cameras', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Drag horizontally to explore')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Kitchen camera/i }));
    expect(screen.getByRole('heading', { name: 'Kitchen camera' })).toBeInTheDocument();
  });

  it('keeps the care recipient list visible in the shared dashboard', async () => {
    renderAt('/dashboard/family');
    expect(await screen.findByRole('heading', { name: 'People you care for' })).toBeInTheDocument();
    expect(await screen.findByText('María García')).toBeInTheDocument();
    expect(screen.getByText('Manuel García')).toBeInTheDocument();
  });

  it('prefills a six-digit pairing code from the join path', async () => {
    renderAt('/join/482701');
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('482701'));
    expect(screen.getByRole('button', { name: /connect this camera/i })).toBeEnabled();
  });

  it('keeps consent and preview setup inline after the camera connects', async () => {
    renderAt('/join/482701');
    fireEvent.click(await screen.findByRole('button', { name: /connect this camera/i }));
    expect(await screen.findByRole('heading', { name: 'Camera connected.' })).toBeInTheDocument();
    expect(screen.getByText('CONNECTED WITH')).toBeInTheDocument();
    expect(screen.getByText('Finish on this device')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I understand what is shared/i })).toBeInTheDocument();
  });

  it('keeps /join for camera pairing', async () => {
    renderAt('/join');
    expect(await screen.findByRole('heading', { name: 'Pair this camera' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Enter a pairing code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect this camera/i })).toBeDisabled();
  });

  it('keeps /join-household for family invitations', async () => {
    renderAt('/join-household');
    expect(await screen.findByRole('heading', { name: 'Join this care space' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invitation code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join household/i })).toBeDisabled();
  });
});
