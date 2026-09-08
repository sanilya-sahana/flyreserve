/**
 * Ordered booking-flow steps.
 * This is the shell contract for routes and the progress stepper; per-step
 * field/behavior specs are owned by SAH-26 (Product Management Spec).
 */
export const BOOKING_STEPS = [
  { path: '/booking/search', label: 'Search', shortLabel: '1. Search' },
  { path: '/booking/select', label: 'Select flight', shortLabel: '2. Select' },
  { path: '/booking/passengers', label: 'Passengers', shortLabel: '3. Passengers' },
  { path: '/booking/checkout', label: 'Checkout', shortLabel: '4. Checkout' },
] as const;

export type BookingStepPath = (typeof BOOKING_STEPS)[number]['path'];

export function currentStepIndex(pathname: string): number {
  const idx = BOOKING_STEPS.findIndex((s) => pathname.startsWith(s.path));
  return idx === -1 ? 0 : idx;
}
