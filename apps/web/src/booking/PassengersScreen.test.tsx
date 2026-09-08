import type { JSX } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PassengersScreen } from './PassengersScreen';

function renderAt(path: string): {
  navigation: { pathname: string; search: string };
} {
  const state = { pathname: '', search: '' };
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/booking/passengers" element={<PassengersScreen />} />
        <Route
          path="/booking/checkout"
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
  return <div>CHECKOUT</div>;
}

describe('PassengersScreen', () => {
  it('renders one passenger fieldset by default and only the first has a contact email', () => {
    renderAt('/booking/passengers');
    expect(
      screen.getByRole('heading', { name: /Passenger details/i }),
    ).toBeInTheDocument();
    // Only one fieldset (default paxCount=1) and it is the contact.
    const legends = screen.getAllByText(/Passenger \d/i);
    expect(legends).toHaveLength(1);
    expect(legends[0].textContent).toMatch(/contact/i);
    expect(screen.getByLabelText(/Contact email/i)).toBeInTheDocument();
  });

  it('renders one fieldset per passenger up to the query-param count, clamped to 9', () => {
    renderAt('/booking/passengers?passengers=3');
    const legends = screen.getAllByText(/Passenger \d/i);
    expect(legends).toHaveLength(3);
    // Contact email only on passenger 1.
    expect(screen.getAllByLabelText(/Contact email/i)).toHaveLength(1);
    // Given/Family name pairs for each passenger.
    expect(screen.getAllByLabelText(/Given name/i)).toHaveLength(3);
    expect(screen.getAllByLabelText(/Family name/i)).toHaveLength(3);
  });

  it('clamps out-of-range or non-integer passenger counts back to 1', () => {
    renderAt('/booking/passengers?passengers=42');
    expect(screen.getAllByText(/Passenger \d/i)).toHaveLength(1);
  });

  it('blocks navigation and surfaces validation errors when required fields are missing', async () => {
    const user = userEvent.setup();
    const { navigation } = renderAt('/booking/passengers');
    await user.click(
      screen.getByRole('button', { name: /Continue to checkout/i }),
    );
    // Still on the passengers page (no LocationCapture rendered).
    expect(screen.queryByText('CHECKOUT')).not.toBeInTheDocument();
    expect(navigation.pathname).toBe('');
    // Inline errors are present.
    expect(screen.getByText(/Given name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Family name is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A valid contact email is required/i),
    ).toBeInTheDocument();
  });

  it('navigates to /booking/checkout and preserves query params when all required fields are valid', async () => {
    const user = userEvent.setup();
    const { navigation } = renderAt(
      '/booking/passengers?flightId=FR-DEMO-101&passengers=1',
    );
    await user.type(screen.getByLabelText(/Given name/i), 'Alex');
    await user.type(screen.getByLabelText(/Family name/i), 'Jordan');
    await user.type(
      screen.getByLabelText(/Contact email/i),
      'alex@example.com',
    );
    await user.click(
      screen.getByRole('button', { name: /Continue to checkout/i }),
    );
    expect(screen.getByText('CHECKOUT')).toBeInTheDocument();
    expect(navigation.pathname).toBe('/booking/checkout');
    expect(navigation.search).toContain('flightId=FR-DEMO-101');
    expect(navigation.search).toContain('passengers=1');
  });
});
