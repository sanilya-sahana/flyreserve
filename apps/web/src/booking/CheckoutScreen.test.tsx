import type { JSX } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CheckoutScreen } from './CheckoutScreen';

function renderAt(path: string): {
  navigation: { pathname: string; search: string };
} {
  const state = { pathname: '', search: '' };
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/booking/checkout" element={<CheckoutScreen />} />
        <Route
          path="/booking/confirmation"
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
  return <div>CONFIRMATION</div>;
}

describe('CheckoutScreen', () => {
  it('renders the review-and-pay chrome with an order summary landmark', () => {
    renderAt('/booking/checkout?flightId=FR-DEMO-101');
    expect(
      screen.getByRole('heading', { name: /Review and pay/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: /Order summary/i }),
    ).toBeInTheDocument();
    // Placeholder totals are present.
    expect(screen.getByText('$281.10')).toBeInTheDocument();
  });

  it('disables Apply until the coupon field has non-blank content and uppercases the input', async () => {
    const user = userEvent.setup();
    renderAt('/booking/checkout');
    const apply = screen.getByRole('button', { name: /Apply/i });
    expect(apply).toBeDisabled();

    await user.type(screen.getByLabelText(/Coupon code/i), 'save10');
    expect(screen.getByLabelText(/Coupon code/i)).toHaveValue('SAVE10');
    expect(apply).toBeEnabled();
  });

  it('navigates to /booking/confirmation and preserves flightId when Place order is clicked', async () => {
    const user = userEvent.setup();
    const { navigation } = renderAt('/booking/checkout?flightId=FR-DEMO-204');
    await user.click(screen.getByRole('button', { name: /Place order/i }));
    // The placeholder implementation uses setTimeout(300); wait for the navigation.
    await screen.findByText('CONFIRMATION');
    expect(navigation.pathname).toBe('/booking/confirmation');
    expect(navigation.search).toContain('flightId=FR-DEMO-204');
  });

  it('falls back to FR-DEMO-000 when no flightId is present', async () => {
    const user = userEvent.setup();
    const { navigation } = renderAt('/booking/checkout');
    await user.click(screen.getByRole('button', { name: /Place order/i }));
    await screen.findByText('CONFIRMATION');
    expect(navigation.search).toContain('flightId=FR-DEMO-000');
  });
});
