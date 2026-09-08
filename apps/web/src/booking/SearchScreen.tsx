import type { JSX } from 'react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field } from '@/design-system';

/**
 * SearchScreen — booking step 1.
 *
 * Fields shown here are the smallest set inferable from the FlyReserve
 * project description ("search flights ... airline selection ...").
 * The authoritative field list (multi-city, cabin class, passenger mix,
 * flexible-date search, etc.) is owned by SAH-26 Product Management Spec.
 */
export function SearchScreen(): JSX.Element {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!origin.trim()) next.origin = 'Origin is required.';
    if (!destination.trim()) next.destination = 'Destination is required.';
    if (!departDate) next.departDate = 'Departure date is required.';
    const count = Number(passengers);
    if (!Number.isInteger(count) || count < 1 || count > 9) {
      next.passengers = 'Passengers must be between 1 and 9.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!validate()) return;
    // Real search wiring pends OpenAPI client (SAH-25 ADR item 10).
    // For the shell we route the user forward with query params so the
    // next screen can echo the search context.
    const params = new URLSearchParams({
      origin,
      destination,
      departDate,
      passengers,
    });
    if (returnDate) params.set('returnDate', returnDate);
    navigate(`/booking/select?${params.toString()}`);
  }

  return (
    <section aria-labelledby="search-heading" className="flex flex-col gap-6">
      <div>
        <h1 id="search-heading" className="text-2xl font-semibold">
          Find flights
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Enter your trip details. You&apos;ll be able to hold a reservation
          before paying.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 rounded-lg border border-surface-border bg-surface p-6 sm:grid-cols-2"
        noValidate
      >
        <Field
          label="From"
          placeholder="Origin airport or city"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          error={errors.origin}
          required
          autoComplete="off"
        />
        <Field
          label="To"
          placeholder="Destination airport or city"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          error={errors.destination}
          required
          autoComplete="off"
        />
        <Field
          label="Departure"
          type="date"
          value={departDate}
          onChange={(e) => setDepartDate(e.target.value)}
          error={errors.departDate}
          required
        />
        <Field
          label="Return"
          type="date"
          value={returnDate}
          onChange={(e) => setReturnDate(e.target.value)}
          hint="Leave blank for a one-way search."
        />
        <Field
          label="Passengers"
          type="number"
          min={1}
          max={9}
          inputMode="numeric"
          value={passengers}
          onChange={(e) => setPassengers(e.target.value)}
          error={errors.passengers}
          required
        />
        <div className="flex items-end justify-end sm:col-span-2">
          <Button type="submit" size="lg">
            Search flights
          </Button>
        </div>
      </form>
    </section>
  );
}
