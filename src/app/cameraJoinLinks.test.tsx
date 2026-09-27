import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { OverviewPage } from './overview';
import { CameraManagerPage } from './publisher';

afterEach(() => vi.restoreAllMocks());

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>);
}

describe('camera-device entry points', () => {
  it('shows the separate camera tab in Camera Manager', () => {
    renderPage(<CameraManagerPage />);
    const link = screen.getByRole('link', { name: 'Use this computer as a camera' });
    expect(link).toHaveAttribute('href', '/join');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens the generated code on this computer without replacing the caregiver tab', async () => {
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
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
