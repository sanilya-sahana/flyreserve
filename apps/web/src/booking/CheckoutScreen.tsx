import type { JSX } from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Field } from '@/design-system';

/**
 * CheckoutScreen — booking step 4.
 *
 * Real coupon validation, tax computation, currency toggling (INR/USD),
 * and Stripe/PayPal payment sheet mounting are pending SAH-26 Spec and
 * backend contract. This shell shows the layout with a coupon field and
 * a placeholder price summary so the flow is walkable.
 */
export function CheckoutScreen(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [coupon, setCoupon] = useState('');
  const [placing, setPlacing] = useState(false);

  function onPlaceOrder(): void {
    setPlacing(true);
    // Placeholder: no server call yet. When the payment contract lands
    // this will call POST /api/reservations/:id/checkout and route to
    // /booking/confirmation/:pnr on success.
    setTimeout(() => {
      const flightId = params.get('flightId') ?? 'FR-DEMO-000';
      navigate(`/booking/confirmation?flightId=${encodeURIComponent(flightId)}`);
    }, 300);
  }

  return (
    <section aria-labelledby="checkout-heading" className="flex flex-col gap-6">
      <div>
        <h1 id="checkout-heading" className="text-2xl font-semibold">
          Review and pay
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Your seat is being held while you check out. Time-to-live and PNR
          display rules are pending confirmation from Product.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4 rounded-lg border border-surface-border bg-surface p-6">
          <h2 className="text-base font-semibold">Payment</h2>
          <p className="text-sm text-text-muted">
            Payment provider selection (Stripe / PayPal) and currency toggle
            will appear here once the payment contract is defined.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <Field
              label="Coupon code"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              hint="Optional. Discount is applied at checkout."
              autoComplete="off"
            />
            <div className="flex items-end">
              <Button variant="secondary" disabled={!coupon.trim()}>
                Apply
              </Button>
            </div>
          </div>
        </div>

        <aside
          aria-label="Order summary"
          className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface p-6"
        >
          <h2 className="text-base font-semibold">Order summary</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">Fare</dt>
              <dd>$249.00</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-muted">Taxes &amp; fees</dt>
              <dd>$32.10</dd>
            </div>
            <div className="flex items-center justify-between border-t border-surface-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>$281.10</dd>
            </div>
          </dl>
          <Button size="lg" onClick={onPlaceOrder} isLoading={placing}>
            {placing ? 'Placing order\u2026' : 'Place order'}
          </Button>
          <p className="text-xs text-text-muted">
            Placeholder totals. Live tax and currency come from the backend.
          </p>
        </aside>
      </div>
    </section>
  );
}
