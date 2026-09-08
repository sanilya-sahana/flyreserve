/**
 * Reservation domain types.
 *
 * State machine derived from SAH-2 (product requirements baseline) and
 * SAH-5 (reservation validity and extension policy).
 */

export type ReservationStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REISSUED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

/** Validity durations explicitly supported per SAH-5 requirements. */
export type ReservationValidity = '48h' | '14d';

export interface Reservation {
  /** Internal booking identifier (UUID) */
  id: string;
  /** Provider-issued PNR or reference */
  providerReference: string;
  /** Optional airline booking reference */
  airlineReference?: string;
  /** Current state of the reservation */
  status: ReservationStatus;
  /** Timestamp when this reservation expires */
  expiresAt: Date;
  /** Validity type chosen at booking */
  validity: ReservationValidity;
  /** ISO-8601 creation timestamp */
  createdAt: Date;
  /** ISO-8601 last-updated timestamp */
  updatedAt: Date;
  /** User account id or null for guest */
  userId: string | null;
}

/**
 * Terminal states. No state transition is valid from these.
 */
export const TERMINAL_STATES: ReadonlySet<ReservationStatus> = new Set([
  'EXPIRED',
  'CANCELLED',
  'REISSUED',
  'REFUNDED',
]);

/**
 * Valid state transitions. Key = from, value = allowed tos.
 * Derived from SAH-2 workflow/state baseline.
 */
export const VALID_TRANSITIONS: Readonly<Record<ReservationStatus, ReservationStatus[]>> = {
  PENDING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAYMENT_PENDING', 'EXPIRING', 'EXPIRED', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'ACTIVE', 'CANCELLED'],
  CONFIRMED: ['REFUND_PENDING', 'REISSUED'],
  EXPIRING: ['EXPIRED', 'ACTIVE'],
  EXPIRED: [],
  CANCELLED: [],
  REISSUED: [],
  REFUND_PENDING: ['REFUNDED', 'CONFIRMED'],
  REFUNDED: [],
};

/**
 * Returns true if moving from `from` to `to` is a valid state transition.
 */
export function isValidTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
