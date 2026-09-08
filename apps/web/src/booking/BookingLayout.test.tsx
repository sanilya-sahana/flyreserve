import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookingLayout } from './BookingLayout';
import { BOOKING_STEPS, currentStepIndex } from './steps';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<BookingLayout />}>
          <Route path="booking/search" element={<div>SEARCH</div>} />
          <Route path="booking/select" element={<div>SELECT</div>} />
          <Route path="booking/passengers" element={<div>PAX</div>} />
          <Route path="booking/checkout" element={<div>CHECKOUT</div>} />
          <Route path="*" element={<div>NOTFOUND</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookingLayout', () => {
  it('exposes an ordered progress nav landmark', () => {
    renderAt('/booking/search');
    const nav = screen.getByRole('navigation', { name: 'Booking progress' });
    expect(nav).toBeInTheDocument();
    // 4 canonical steps rendered.
    BOOKING_STEPS.forEach((s) => {
      expect(screen.getByText(s.shortLabel)).toBeInTheDocument();
    });
  });

  it('marks the current step with aria-current="step"', () => {
    renderAt('/booking/passengers');
    const current = screen
      .getAllByText(/^\d\. /)
      .find((el) => el.getAttribute('aria-current') === 'step');
    expect(current).toBeDefined();
    expect(current?.textContent).toContain('Passengers');
  });

  it('hides the progress nav and emits no aria-current on unknown paths', () => {
    // Regression guard for SAH-38 F1: previously `currentStepIndex` fell back
    // to 0 for unknown paths, silently marking Search active on
    // /booking/confirmation and every 404. The stepper must not render at all.
    renderAt('/somewhere-unknown');
    expect(
      screen.queryByRole('navigation', { name: 'Booking progress' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('currentStepIndex maps known wizard paths and returns -1 on unknown', () => {
    expect(currentStepIndex('/booking/search')).toBe(0);
    expect(currentStepIndex('/booking/select?x=1')).toBe(1);
    expect(currentStepIndex('/booking/passengers')).toBe(2);
    expect(currentStepIndex('/booking/checkout')).toBe(3);
    // Post-purchase confirmation and other unknowns must NOT map to a wizard step.
    expect(currentStepIndex('/booking/confirmation')).toBe(-1);
    expect(currentStepIndex('/something-else')).toBe(-1);
    expect(currentStepIndex('/')).toBe(-1);
  });
});
