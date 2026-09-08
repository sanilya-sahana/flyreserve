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

/**
 * Returns the index of the current step in BOOKING_STEPS, or -1 if the given
 * pathname does not correspond to any wizard step (e.g. the post-purchase
 * confirmation route, a 404, or an unknown path).
 *
 * Returning -1 is intentional and load-bearing: it lets callers (BookingLayout)
 * omit `aria-current="step"` entirely on non-wizard paths, instead of silently
 * defaulting to "Search" and telling screen-reader users they are back at step
 * 1 after a successful purchase. See SAH-38 finding F1 and F8.
 */
export function currentStepIndex(pathname: string): number {
  return BOOKING_STEPS.findIndex((s) => pathname.startsWith(s.path));
}
