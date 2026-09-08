import type { JSX } from 'react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/design-system';

/**
 * SelectFlightScreen — booking step 2.
 *
 * The real flight list, filters, sort keys, and INR/USD currency toggle
 * are pending SAH-26 Spec and SAH-25 ADR item 10 (OpenAPI client).
 * This shell shows a small deterministic placeholder set so the flow
 * is walkable end-to-end for demo and Playwright bootstrap.
 */
interface PlaceholderFlight {
  id: string;
  airline: string;
  depart: string;
  arrive: string;
  duration: string;
  priceUsd: number;
}

const PLACEHOLDER_FLIGHTS: readonly PlaceholderFlight[] = [
  {
    id: 'FR-DEMO-101',
    airline: 'Placeholder Air',
    depart: '08:15',
    arrive: '11:40',
    duration: '3h 25m',
    priceUsd: 249,
  },
  {
    id: 'FR-DEMO-204',
    airline: 'Placeholder Air',
    depart: '13:05',
    arrive: '16:20',
    duration: '3h 15m',
    priceUsd: 279,
  },
];

export function SelectFlightScreen(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const summary = useMemo(() => {
    const origin = params.get('origin') ?? '';
    const destination = params.get('destination') ?? '';
    const departDate = params.get('departDate') ?? '';
    return { origin, destination, departDate };
  }, [params]);

  function chooseFlight(id: string): void {
    const next = new URLSearchParams(params);
    next.set('flightId', id);
    navigate(`/booking/passengers?${next.toString()}`);
  }

  return (
    <section aria-labelledby="select-heading" className="flex flex-col gap-6">
      <div>
        <h1 id="select-heading" className="text-2xl font-semibold">
          Choose a flight
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {summary.origin && summary.destination
            ? `${summary.origin} \u2192 ${summary.destination}${
                summary.departDate ? ` on ${summary.departDate}` : ''
              }`
            : 'Complete the search on the previous step to see live results.'}
        </p>
      </div>

      <p
        role="note"
        className="rounded-md border border-surface-border bg-surface-muted p-3 text-xs text-text-muted"
      >
        Live flight results depend on the OpenAPI client (SAH-25 ADR item 10)
        and per-screen behavior spec (SAH-26). Placeholder results are shown
        so the booking shell is walkable.
      </p>

      <ul className="flex flex-col gap-3">
        {PLACEHOLDER_FLIGHTS.map((f) => (
          <li
            key={f.id}
            className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold">{f.airline}</p>
              <p className="text-sm text-text-muted">
                {f.depart} – {f.arrive} · {f.duration}
              </p>
              <p className="text-xs text-text-muted">Flight {f.id}</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-lg font-semibold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(f.priceUsd)}
              </p>
              <Button onClick={() => chooseFlight(f.id)}>Select</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
