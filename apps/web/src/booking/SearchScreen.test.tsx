import type { JSX } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SearchScreen } from './SearchScreen';

function LocationEcho(): JSX.Element {
  const loc = useLocation();
  return (
    <div data-testid="loc">
      {loc.pathname}
      {loc.search}
    </div>
  );
}

function renderScreen(): void {
  render(
    <MemoryRouter initialEntries={['/booking/search']}>
      <Routes>
        <Route path="/booking/search" element={<SearchScreen />} />
        <Route path="/booking/select" element={<LocationEcho />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchScreen', () => {
  it('shows a validation error when required fields are missing', async () => {
    renderScreen();
    await userEvent.click(
      screen.getByRole('button', { name: 'Search flights' }),
    );
    expect(await screen.findByText('Origin is required.')).toBeInTheDocument();
    expect(screen.getByText('Destination is required.')).toBeInTheDocument();
    expect(screen.getByText('Departure date is required.')).toBeInTheDocument();
  });

  it('navigates to /booking/select with query params on valid submit', async () => {
    renderScreen();
    await userEvent.type(screen.getByLabelText(/From/), 'BLR');
    await userEvent.type(screen.getByLabelText(/To/), 'DXB');
    await userEvent.type(screen.getByLabelText(/Departure/), '2027-01-15');
    await userEvent.click(
      screen.getByRole('button', { name: 'Search flights' }),
    );
    const loc = await screen.findByTestId('loc');
    expect(loc.textContent).toContain('/booking/select');
    expect(loc.textContent).toContain('origin=BLR');
    expect(loc.textContent).toContain('destination=DXB');
    expect(loc.textContent).toContain('departDate=2027-01-15');
    expect(loc.textContent).toContain('passengers=1');
  });

  it('rejects an out-of-range passenger count', async () => {
    renderScreen();
    await userEvent.type(screen.getByLabelText(/From/), 'BLR');
    await userEvent.type(screen.getByLabelText(/To/), 'DXB');
    await userEvent.type(screen.getByLabelText(/Departure/), '2027-01-15');
    const paxInput = screen.getByLabelText(/Passengers/);
    await userEvent.clear(paxInput);
    await userEvent.type(paxInput, '99');
    await userEvent.click(
      screen.getByRole('button', { name: 'Search flights' }),
    );
    expect(
      await screen.findByText('Passengers must be between 1 and 9.'),
    ).toBeInTheDocument();
  });
});
