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
    expect(screen.getByRole('button', { name: /continue as publisher/i })).toBeEnabled();
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
});
