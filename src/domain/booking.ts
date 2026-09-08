/**
 * Booking (reservation + passenger + contact aggregate) domain types.
 *
 * A Booking is created when a customer completes checkout for a temporary
 * reservation. It ties together:
 *   - the flight selection (via resultToken / providerItineraryId)
 *   - the reservation hold record
 *   - passenger details
 *   - pricing snapshot at purchase time
 *   - payment reference
 *
 * Derived from SAH-2, SAH-3, SAH-5, SAH-8.
 */

import type { Reservation } from './reservation.js';
import type { Payment } from './payment.js';
import type { Passenger, BookingContact } from './passenger.js';
import type { Money } from './payment.js';

export interface PricingSnapshot {
  /** Base fare per passenger (from provider at the time of booking) */
  baseFarePerPassenger: Money;
  /** Number of passengers */
  passengerCount: number;
  /** Service fee added by FlyReserve */
  serviceFee: Money;
  /** Coupon discount (zero if no coupon applied) */
  couponDiscount: Money;
  /** Tax calculated on (baseFare * passengers + serviceFee - couponDiscount) */
  tax: Money;
  /** Final total charged */
  total: Money;
  /** Coupon code applied (null if none) */
  couponCode: string | null;
  /** Tax rate as a decimal (e.g. 0.18 for 18%) */
  taxRate: number;
}

export type BookingStatus =
  | 'INITIATED'
  | 'RESERVATION_HELD'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface Booking {
  id: string;
  /** Reservation hold record */
  reservation: Reservation;
  /** All passengers on the booking */
  passengers: Passenger[];
  /** Lead passenger contact */
  contact: BookingContact;
  /** Pricing snapshot captured at checkout */
  pricing: PricingSnapshot;
  /** Payment record (null until payment is initiated) */
  payment: Payment | null;
  status: BookingStatus;
  /** ISO-8601 creation timestamp */
  createdAt: Date;
  /** ISO-8601 last-updated timestamp */
  updatedAt: Date;
}
