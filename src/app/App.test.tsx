import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('ONE dashboard', () => {
  it('renders the caregiver overview in demo mode', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Bring one more set of eyes into the room.')).toBeInTheDocument());
    expect(screen.getByText('Small moments, kept meaningful.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause care/i })).toBeInTheDocument();
  });

  it('prefills a six-digit pairing code from the join path', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/join/482701']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('482701'));
    expect(screen.getByRole('button', { name: /connect this camera/i })).toBeEnabled();
  });

  it('keeps consent and preview setup inline after the camera connects', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/join/482701']}><App /></MemoryRouter></QueryClientProvider>);
    const connectButton = await screen.findByRole('button', { name: /connect this camera/i });
    fireEvent.click(connectButton);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Camera connected.' })).toBeInTheDocument());
    expect(screen.getByText('CONNECTED WITH')).toBeInTheDocument();
    expect(screen.getByText('Finish on this device')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I understand what is shared/i })).toBeInTheDocument();
  });

  it('keeps /join as the camera pairing flow', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/join']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bring ONE into the room.' })).toBeInTheDocument());
    expect(screen.getByText('PAIR A CAMERA')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Enter a pairing code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect this camera/i })).toBeDisabled();
    expect(screen.getByText(/This is device setup, not household sign-in/)).toBeInTheDocument();
    expect(screen.queryByText('JOIN A HOUSEHOLD')).not.toBeInTheDocument();
  });

  it('keeps /join-household as the household invitation flow', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/join-household']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Care works better together.' })).toBeInTheDocument());
    expect(screen.getByText('JOIN A HOUSEHOLD')).toBeInTheDocument();
    expect(screen.getByText(/does not pair a camera/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invited email' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invitation code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join household/i })).toBeDisabled();
    expect(screen.queryByText('PAIR A DEVICE')).not.toBeInTheDocument();
  });

  it('shows live account and household entry points on the login screen', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('WELCOME TO ONE')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /create your one home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join an existing household/i })).toBeInTheDocument();
  });

  it('renders Family mode from the dashboard route', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/family']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Care works better together.')).toBeInTheDocument());
    expect(screen.getByText('Admin + caregiver')).toBeInTheDocument();
    expect(screen.getByText('Next dose')).toBeInTheDocument();
    expect(screen.getByText('Assigned to Jordi García · No acknowledgement yet')).toBeInTheDocument();
    expect(screen.getByText('Needs confirmation')).toBeInTheDocument();
  });

  it('renders camera geometry as accessible 2D and hides the 3D control', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/map']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText(/CAMERA-DERIVED 2D MAP/)).toBeInTheDocument());
    expect(screen.getByRole('img', { name: /Camera-derived 2D room map/ })).toBeInTheDocument();
    expect(container.querySelectorAll('.camera-map-polygon')).toHaveLength(4);
    expect(screen.getByText(/relative geometry · not to scale/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3D' })).not.toBeInTheDocument();
  });

  it('opens the medication plan form and preserves a recurrence rule', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/family']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Care works better together.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add plan/i }));
    expect(screen.getByRole('heading', { name: /add reminder plan/i })).toBeInTheDocument();
    const schedule = screen.getByPlaceholderText(/Mon,Wed,Fri/);
    fireEvent.change(schedule, { target: { value: 'Mon,Wed,Fri @ 08:00' } });
    expect(schedule).toHaveValue('Mon,Wed,Fri @ 08:00');
  });

  it('creates a camera code in the dashboard without leaving the page', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /pair a camera/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pair a camera/i }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: /connect a phone or laptop/i })).toBeInTheDocument());
    expect(screen.getByText('482701')).toBeInTheDocument();
    expect(screen.getByText(/Keep this screen open/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Camera connected')).toBeInTheDocument());
  });

  it('saves the connected camera and describes automatic mapping inline', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /pair a camera/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pair a camera/i }));
    const saveButton = await screen.findByRole('button', { name: /save camera setup/i });
    fireEvent.click(saveButton);
    await waitFor(() => expect(screen.getByText('AUTOMATIC 2D MAP')).toBeInTheDocument());
    expect(screen.getByText(/camera-derived geometry is saved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start calibration/i })).not.toBeInTheDocument();
  });

  it('exposes account settings with an explicit sign-out action', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/account']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Keep your access clear.')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: /privacy & consent/i })).toBeInTheDocument();
  });
});
