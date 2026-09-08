import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfirmationLayout } from './ConfirmationLayout';
import { ConfirmationScreen } from './ConfirmationScreen';

describe('ConfirmationLayout', () => {
  it('renders the post-purchase chrome without a booking-progress stepper', () => {
    // Regression guard for SAH-38 F1: the confirmation route must never render
    // the wizard progress stepper, because doing so tells screen-reader users
    // they are back at step 1/4 after a successful purchase.
    render(
      <MemoryRouter initialEntries={['/booking/confirmation?flightId=FR-TEST']}>
        <Routes>
          <Route path="/booking/confirmation" element={<ConfirmationLayout />}>
            <Route index element={<ConfirmationScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    // The confirmation heading is present.
    expect(
      screen.getByRole('heading', { name: /Reservation confirmed/i }),
    ).toBeInTheDocument();

    // The wizard stepper landmark is NOT in the DOM.
    expect(
      screen.queryByRole('navigation', { name: 'Booking progress' }),
    ).not.toBeInTheDocument();

    // No element carries aria-current="step".
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });
});
