import type { JSX } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SelectFlightScreen } from './SelectFlightScreen';

function renderAt(path: string): {
  navigation: { pathname: string; search: string };
} {
  const state = { pathname: '', search: '' };
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/booking/select" element={<SelectFlightScreen />} />
        <Route
          path="/booking/passengers"
          element={
            <LocationCapture
              onCapture={(pathname, search) => {
                state.pathname = pathname;
                state.search = search;
              }}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { navigation: state };
}

function LocationCapture(props: {
  onCapture: (pathname: string, search: string) => void;
}): JSX.Element {
  const loc = useLocation();
  props.onCapture(loc.pathname, loc.search);
  return <div>PAX</div>;
}

describe('SelectFlightScreen', () => {
  it('renders the heading and the placeholder flight rows', () => {
    renderAt('/booking/select?origin=SFO&destination=JFK&departDate=2026-10-01');
    expect(
      screen.getByRole('heading', { name: /Choose a flight/i }),
    ).toBeInTheDocument();
    // Two placeholder flights with airline names and Select buttons.
    expect(screen.getAllByRole('button', { name: /Select/i })).toHaveLength(2);
    // Search summary reflects the query params.
    expect(screen.getByText(/SFO/)).toBeInTheDocument();
    expect(screen.getByText(/JFK/)).toBeInTheDocument();
  });

  it('falls back to a hint when search params are missing', () => {
    renderAt('/booking/select');
    expect(
      screen.getByText(/Complete the search on the previous step/i),
    ).toBeInTheDocument();
  });

  it('forwards to /booking/passengers with the selected flightId in the query string', async () => {
    const user = userEvent.setup();
    const { navigation } = renderAt(
      '/booking/select?origin=SFO&destination=JFK&departDate=2026-10-01&passengers=2',
    );
    const buttons = screen.getAllByRole('button', { name: /Select/i });
    await user.click(buttons[0]);

    expect(screen.getByText('PAX')).toBeInTheDocument();
    expect(navigation.pathname).toBe('/booking/passengers');
    // The prior query params are preserved and flightId is added.
    expect(navigation.search).toContain('origin=SFO');
    expect(navigation.search).toContain('destination=JFK');
    expect(navigation.search).toContain('passengers=2');
    expect(navigation.search).toContain('flightId=FR-DEMO-101');
  });
});
