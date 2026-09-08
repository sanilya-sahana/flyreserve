import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('associates label with input via generated id', () => {
    render(<Field label="Origin" />);
    const input = screen.getByLabelText('Origin');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('marks required visually and semantically', () => {
    render(<Field label="Origin" required />);
    const input = screen.getByLabelText(/Origin/);
    expect(input).toBeRequired();
  });

  it('renders error text with role=alert and wires aria-describedby', () => {
    render(<Field label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a valid email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain('-error');
  });

  it('renders hint text and suppresses it when an error is present', () => {
    const { rerender } = render(
      <Field label="Coupon" hint="Optional promo code" />,
    );
    expect(screen.getByText('Optional promo code')).toBeInTheDocument();

    rerender(<Field label="Coupon" hint="Optional promo code" error="Bad" />);
    expect(screen.queryByText('Optional promo code')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Bad');
  });
});
