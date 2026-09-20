import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('ONE dashboard', () => {
  it('renders the caregiver overview in demo mode', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Your home, in view.')).toBeInTheDocument());
    expect(screen.getByText('Recent observations')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pair this camera' })).toBeInTheDocument());
    expect(screen.getByText('PAIR A CAMERA')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Enter a pairing code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect this camera/i })).toBeDisabled();
    expect(screen.getByText(/This is device setup, not household sign-in/)).toBeInTheDocument();
    expect(screen.queryByText('JOIN A HOUSEHOLD')).not.toBeInTheDocument();
  });

  it('keeps /join-household as the household invitation flow', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/join-household']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Join this care space' })).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to your care space.' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /create a home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join with an invite/i })).toBeInTheDocument();
  });

  it('renders Family mode from the dashboard route', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/family']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Family & care team')).toBeInTheDocument());
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
    expect(container.querySelectorAll('.camera-map-furniture')).toHaveLength(3);
    expect(container.querySelectorAll('.camera-map-opening')).toHaveLength(2);
    expect(screen.getByText(/add one measured wall, doorway, or object reference/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /measure map scale/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3D' })).not.toBeInTheDocument();
  });

  it('measures a two-point reference and shows the calibrated scale bar', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/map']}><App /></MemoryRouter></QueryClientProvider>);
    const measureButton = await screen.findByRole('button', { name: /measure map scale/i });
    await waitFor(() => expect(measureButton).toBeEnabled());
    fireEvent.click(measureButton);
    const map = container.querySelector('svg.camera-map-svg.is-measuring') as SVGSVGElement;
    expect(map).toBeInTheDocument();
    Object.defineProperty(map, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 100, height: 100 }) });
    fireEvent.click(map, { clientX: 10, clientY: 20 });
    fireEvent.click(map, { clientX: 70, clientY: 20 });
    expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reference name'), { target: { value: 'Hallway door' } });
    fireEvent.change(screen.getByLabelText('Actual length (metres)'), { target: { value: '0.90' } });
    fireEvent.click(screen.getByRole('button', { name: /save measured scale/i }));
    await waitFor(() => expect(screen.getByText(/Hallway door:/)).toBeInTheDocument());
    expect(screen.getByText(/Measured reference · 0.90 m/)).toBeInTheDocument();
    expect(document.querySelector('.camera-map-scale-bar')).toBeInTheDocument();
  });

  it('opens the medication plan form and preserves a recurrence rule', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/family']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Family & care team')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add plan/i }));
    expect(screen.getByRole('heading', { name: /add reminder plan/i })).toBeInTheDocument();
    const schedule = screen.getByPlaceholderText(/Mon,Wed,Fri/);
    fireEvent.change(schedule, { target: { value: 'Mon,Wed,Fri @ 08:00' } });
    expect(schedule).toHaveValue('Mon,Wed,Fri @ 08:00');
  });

  it('creates a camera code in the dashboard without leaving the page', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /pair camera/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pair camera/i }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: /connect a phone or laptop/i })).toBeInTheDocument());
    expect(screen.getByText('482701')).toBeInTheDocument();
    expect(screen.getByText(/camera is saved\. Positioning and room mapping start only when you choose them later/i)).toBeInTheDocument();
    expect(screen.getByText(/Expires in 10 minutes/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Camera connected and saved')).toBeInTheDocument());
  });

  it('saves the connected camera without starting spatial setup', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /pair camera/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /pair camera/i }));
    const saveButton = await screen.findByRole('button', { name: /save camera setup/i });
    fireEvent.click(saveButton);
    await waitFor(() => expect(screen.getByText('CAMERA READY')).toBeInTheDocument());
    expect(screen.getByText(/Calibration, manual placement, and room mapping are optional and only run when you choose them/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open live view & manage camera/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start calibration/i })).not.toBeInTheDocument();
  });

  it('exposes account actions from the header profile menu', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/account']}><App /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Account settings' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /open profile menu/i }));
    expect(screen.getByRole('menu', { name: /profile menu/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^help$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^log out$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    await waitFor(() => expect(screen.getByRole('complementary', { name: /one care navigation/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /safety & settings/i }));
    expect(screen.getByRole('link', { name: /privacy & consent/i })).toBeInTheDocument();
  });

  it('keeps sidebar submenus collapsed until their group is opened', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/events']}><App /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    await waitFor(() => expect(screen.getByRole('complementary', { name: /one care navigation/i })).toBeInTheDocument());

    const careTogether = screen.getByRole('button', { name: /care together/i });
    const safetySettings = screen.getByRole('button', { name: /safety & settings/i });
    expect(careTogether).toHaveAttribute('aria-expanded', 'false');
    expect(safetySettings).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /assistant/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /privacy & consent/i })).not.toBeInTheDocument();

    fireEvent.click(careTogether);
    expect(careTogether).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /family/i })).toBeInTheDocument();

    fireEvent.click(safetySettings);
    expect(safetySettings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /privacy & consent/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /account settings/i })).toBeInTheDocument();
  });

  it('manages the active care space separately from the care recipient', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    const careSpaceButton = await screen.findByRole('button', { name: /the garcía home/i });
    const recipientButton = screen.getByRole('button', { name: /care recipient/i });
    expect(screen.queryByRole('combobox', { name: /care recipient/i })).not.toBeInTheDocument();
    fireEvent.click(recipientButton);
    expect(screen.getByRole('listbox', { name: /care recipient options/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /maría garcía.*main bedroom/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /manuel garcía.*main bedroom/i })).toBeInTheDocument();

    fireEvent.click(careSpaceButton);
    expect(screen.getByRole('dialog', { name: /manage care spaces/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /casa dels avis/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add a care space/i }));
    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & switch/i })).toBeDisabled();
  });
});
