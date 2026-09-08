import type { JSX } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/design-system';

/**
 * ConfirmationScreen — booking step 5 (post-purchase).
 *
 * PNR generation, e-ticket download link, and invoice link are backend-owned
 * outputs. Rendering them here waits on the API contract and SAH-26 Spec.
 */
export function ConfirmationScreen(): JSX.Element {
  const [params] = useSearchParams();
  const flightId = params.get('flightId') ?? '';

  return (
    <section
      aria-labelledby="confirm-heading"
      className="flex flex-col items-center gap-6 py-8 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-500">
        <span aria-hidden="true" className="text-2xl">
          &#10003;
        </span>
      </div>
      <div>
        <h1 id="confirm-heading" className="text-2xl font-semibold">
          Reservation confirmed
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Your booking is confirmed. Your PNR, e-ticket, and invoice will be
          available here and in your email once the payment contract is wired.
        </p>
      </div>
      {flightId ? (
        <p className="text-sm">
          Flight reference: <code className="rounded bg-surface-muted px-1.5 py-0.5">{flightId}</code>
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button asChild variant="secondary">
          <Link to="/booking/search">Book another flight</Link>
        </Button>
      </div>
    </section>
  );
}
