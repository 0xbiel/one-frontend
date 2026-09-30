import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, saveCameraReconnect } from '../api/client';
import { OverviewPage } from './overview';
import { CameraManagerPage } from './publisher';
import { JoinPage } from './pages/CameraPairingPage';
import { rememberDashboardSession } from './cameraReturnSession';

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear(); });

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>);
}

describe('camera-device entry points', () => {
  it('reuses a saved camera link instead of requesting another pairing code', async () => {
    sessionStorage.setItem('one_access_token', 'caregiver-token');
    saveCameraReconnect('camera-1', 'saved-reconnect-token');
    vi.spyOn(api, 'getCameras').mockResolvedValue([{ id: 'camera-1', label: 'Hall camera', platform: 'browser', status: 'offline', lastSeenAt: '2026-09-29T12:00:00Z' }]);
    renderPage(<CameraManagerPage />);
    const link = await screen.findByRole('link', { name: 'Reconnect Hall camera on this computer' });
    expect(link).toHaveAttribute('href', '/camera/camera-1');
    fireEvent.click(link);
    expect(sessionStorage.getItem('one_camera_dashboard_return')).toContain('caregiver-token');
  });
  it('opens camera setup in the same tab and remembers the dashboard session', () => {
    sessionStorage.setItem('one_access_token', 'caregiver-token');
    sessionStorage.setItem('one_home_id', 'home-1');
    sessionStorage.setItem('one_user_id', 'caregiver-1');
    renderPage(<CameraManagerPage />);
    const link = screen.getByRole('link', { name: 'Use this computer as a camera' });
    expect(link).toHaveAttribute('href', '/join');
    expect(link).not.toHaveAttribute('target');
    fireEvent.click(link);
    expect(sessionStorage.getItem('one_camera_dashboard_return')).toContain('caregiver-token');
  });

  it('opens the generated code on this computer in the same tab', async () => {
    vi.spyOn(api, 'getCameras').mockResolvedValue([]);
    vi.spyOn(api, 'createPairing').mockResolvedValue({ pairing_id: 'pair-1', code: '482701', expires_at: '2026-09-27T19:00:00Z' });
    vi.spyOn(api, 'getPairingStatus').mockResolvedValue({
      pairing_id: 'pair-1', home_id: 'home-1', status: 'pending', expires_at: '2026-09-27T19:00:00Z',
      device: { id: 'camera-1', label: 'Camera', role: 'publisher' },
    });
    renderPage(<OverviewPage events={[]} objects={[]} onEvent={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pair camera' }));
    const link = await screen.findByRole('link', { name: /open camera setup on this computer/i });
    expect(link).toHaveAttribute('href', '/join/482701');
    expect(link).not.toHaveAttribute('target');
  });

  it('returns from Join to the dashboard with the caregiver session restored', () => {
    sessionStorage.setItem('one_access_token', 'caregiver-token');
    sessionStorage.setItem('one_home_id', 'home-1');
    sessionStorage.setItem('one_user_id', 'caregiver-1');
    rememberDashboardSession();
    sessionStorage.setItem('one_access_token', 'camera-token');
    sessionStorage.setItem('one_user_id', 'camera-1');
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/join']}><Routes>
      <Route path="/join" element={<JoinPage />} />
      <Route path="/dashboard" element={<div>Dashboard restored</div>} />
    </Routes></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Dashboard restored')).toBeInTheDocument();
    expect(sessionStorage.getItem('one_access_token')).toBe('caregiver-token');
    expect(sessionStorage.getItem('one_user_id')).toBe('caregiver-1');
    expect(sessionStorage.getItem('one_camera_dashboard_return')).toBeNull();
  });
});
