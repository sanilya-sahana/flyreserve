/**
 * Payment domain types.
 *
 * State machine and rules derived from SAH-2 (product requirements baseline)
 * and SAH-8 (pricing, fees, taxes, FX rules).
 */

export type PaymentStatus =
  | 'CREATED'
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

/** Launch currencies per SAH-2. INR and USD only at launch. */
export type Currency = 'INR' | 'USD';

/** Supported payment providers per SAH-2. */
export type PaymentProvider = 'STRIPE' | 'PAYPAL';

export interface Money {
  /** Amount in the smallest unit (paise for INR, cents for USD). */
  amountMinorUnits: number;
  currency: Currency;
}

export interface Payment {
  /** Internal payment identifier (UUID) */
  id: string;
  /** Reservation this payment belongs to */
  reservationId: string;
  /** Provider-issued payment intent / order id */
  providerPaymentId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: Money;
  /** ISO-8601 creation timestamp */
  createdAt: Date;
  /** ISO-8601 last-updated timestamp */
  updatedAt: Date;
}

/**
 * Valid state transitions for payments.
 * Derived from SAH-2 payment states.
 */
export const VALID_PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, PaymentStatus[]>> = {
  CREATED: ['REQUIRES_ACTION', 'PROCESSING', 'FAILED', 'CANCELLED'],
  REQUIRES_ACTION: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: ['REFUND_PENDING'],
  FAILED: [],
  CANCELLED: [],
  REFUND_PENDING: ['REFUNDED', 'SUCCEEDED'],
  REFUNDED: [],
};

export function isValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return VALID_PAYMENT_TRANSITIONS[from].includes(to);
}
