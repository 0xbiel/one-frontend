import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
}

describe('ONE web routes', () => {
  it('shows the current demo overview and pause control', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Your Home, in view' })).toBeInTheDocument();
    expect(screen.getByText('Recent observations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pause care/i }));
    expect(screen.getByText('Care is paused in this demo.')).toBeInTheDocument();
  });

  it('shows the current login and registration entry', async () => {
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: /Care,\s*made closer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create a care space/i })).toBeInTheDocument();
  });

  it('shows cameras in their dedicated dashboard page', async () => {
    renderAt('/dashboard/cameras');
    expect(await screen.findByRole('heading', { name: 'Cameras' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /conectar cámara/i })).toBeInTheDocument();
    expect(screen.getByText('La cámara aparecerá aquí')).toBeInTheDocument();
  });

  it('keeps family members visible and lets the demo add a person', async () => {
    renderAt('/dashboard/family');
    expect(await screen.findByRole('heading', { name: 'Family & care team' })).toBeInTheDocument();
    expect(screen.getByText('3 people in ONE Home')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add person/i }));
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Alex Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to demo' }));
    expect(screen.getByText('Alex Example')).toBeInTheDocument();
    expect(screen.getByText('4 people in ONE Home')).toBeInTheDocument();
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
