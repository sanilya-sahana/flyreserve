import type { JSX } from 'react';
import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Field } from '@/design-system';

/**
 * PassengersScreen — booking step 3.
 *
 * Only the minimum fields inferable from the project description are shown
 * (name, contact). Required-document rules, DOB format, minor policy,
 * frequent flyer input, and per-airline ID rules are pending SAH-26 Spec.
 */
interface PassengerDraft {
  givenName: string;
  familyName: string;
  email: string;
}

function emptyPassenger(): PassengerDraft {
  return { givenName: '', familyName: '', email: '' };
}

export function PassengersScreen(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paxCount = useMemo(() => {
    const n = Number(params.get('passengers') ?? '1');
    return Number.isInteger(n) && n >= 1 && n <= 9 ? n : 1;
  }, [params]);

  const [passengers, setPassengers] = useState<PassengerDraft[]>(() =>
    Array.from({ length: paxCount }, emptyPassenger),
  );
  const [errors, setErrors] = useState<Record<number, Partial<Record<keyof PassengerDraft, string>>>>({});

  function updatePassenger(
    idx: number,
    key: keyof PassengerDraft,
    value: string,
  ): void {
    setPassengers((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  function validate(): boolean {
    const next: typeof errors = {};
    passengers.forEach((p, i) => {
      const rowErrors: Partial<Record<keyof PassengerDraft, string>> = {};
      if (!p.givenName.trim()) rowErrors.givenName = 'Given name is required.';
      if (!p.familyName.trim()) rowErrors.familyName = 'Family name is required.';
      if (i === 0) {
        // The first passenger is treated as the booking contact for now.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
          rowErrors.email = 'A valid contact email is required.';
        }
      }
      if (Object.keys(rowErrors).length > 0) next[i] = rowErrors;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!validate()) return;
    // Hold-a-reservation is a server call that depends on the reservation
    // TTL and PNR generation contract (SAH-26 + backend API contract).
    // In the shell we forward to checkout with the passenger count preserved.
    navigate(`/booking/checkout?${params.toString()}`);
  }

  return (
    <section aria-labelledby="pax-heading" className="flex flex-col gap-6">
      <div>
        <h1 id="pax-heading" className="text-2xl font-semibold">
          Passenger details
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Enter each passenger&apos;s legal name as it appears on their travel
          document. The first passenger is the booking contact.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {passengers.map((p, i) => (
          <fieldset
            key={i}
            className="rounded-lg border border-surface-border bg-surface p-6"
          >
            <legend className="px-2 text-sm font-medium text-text">
              Passenger {i + 1}
              {i === 0 ? ' (contact)' : ''}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Given name"
                required
                value={p.givenName}
                onChange={(e) =>
                  updatePassenger(i, 'givenName', e.target.value)
                }
                error={errors[i]?.givenName}
                autoComplete="given-name"
              />
              <Field
                label="Family name"
                required
                value={p.familyName}
                onChange={(e) =>
                  updatePassenger(i, 'familyName', e.target.value)
                }
                error={errors[i]?.familyName}
                autoComplete="family-name"
              />
              {i === 0 ? (
                <Field
                  label="Contact email"
                  type="email"
                  required
                  value={p.email}
                  onChange={(e) => updatePassenger(i, 'email', e.target.value)}
                  error={errors[i]?.email}
                  autoComplete="email"
                  hint="Booking confirmation and e-tickets will be sent here."
                />
              ) : null}
            </div>
          </fieldset>
        ))}
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Continue to checkout
          </Button>
        </div>
      </form>
    </section>
  );
}
