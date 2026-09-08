/**
 * Checkout service — orchestrates the booking creation flow.
 *
 * Checkout sequence (per SAH-2 Module 3):
 *  1. Validate passengers and contact details.
 *  2. Validate/resolve the flight result token (revalidate price).
 *  3. Resolve optional coupon.
 *  4. Compute pricing snapshot.
 *  5. Create a reservation hold.
 *  6. Activate the reservation (moves PENDING → ACTIVE).
 *  7. Transition to PAYMENT_PENDING.
 *  8. Persist the Booking record.
 *  9. Return the booking for the caller to initiate payment.
 *
 * Payment initiation (Stripe/PayPal) is the next step and is NOT included
 * here — it is a Payment service responsibility (to be implemented once
 * payment-provider credentials and contracts are confirmed — blocked by
 * SAH-16 / DevOps and SAH-10 / provider selection).
 *
 * Known gaps / blockers (recorded per SAH-20 scope):
 *  - Payment initiation: Stripe/PayPal provider contract not yet established.
 *    Blocked by SAH-16 (infrastructure/credentials) and SAH-10 (provider).
 *  - Persistent booking store: in-memory only until SAH-21 delivers schema.
 *  - Coupon repository: in-memory hardcoded; production needs persistent store
 *    with atomic usedCount increment.
 *  - Invoice/ticket generation (PDF/email delivery) is a follow-on service.
 *  - FX conversion (INR↔USD) is blocked until SAH-8 FX rules are finalised.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Passenger, BookingContact } from '../domain/passenger.js';
import { validatePassenger, validateContact, PassengerValidationError } from '../domain/passenger.js';
import type { Booking } from '../domain/booking.js';
import type { Coupon } from '../domain/coupon.js';
import { CouponError } from '../domain/coupon.js';
import type { ReservationValidity } from '../domain/reservation.js';
import type { FlightSearchService } from './flightSearchService.js';
import type { ReservationService } from './reservationService.js';
import { computePricing } from './pricingService.js';

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export interface CheckoutInput {
  /** Result token from the flight search step */
  resultToken: string;
  passengers: Passenger[];
  contact: BookingContact;
  /** Reservation validity chosen by user */
  validity: ReservationValidity;
  /** Optional coupon code */
  couponCode?: string;
  /** User ID, or null for guest checkout */
  userId: string | null;
}

export class CheckoutService {
  /** In-memory booking store (production: inject a repository) */
  private readonly bookings = new Map<string, Booking>();

  /** In-memory coupon registry (production: inject a repository) */
  private readonly coupons = new Map<string, Coupon>();

  constructor(
    private readonly flightSearchService: FlightSearchService,
    private readonly reservationService: ReservationService,
  ) {
    // Seed a test coupon for development
    this.coupons.set('WELCOME10', {
      code: 'WELCOME10',
      kind: 'PERCENT',
      value: 10,
      active: true,
      usedCount: 0,
    });
    this.coupons.set('FLAT500', {
      code: 'FLAT500',
      kind: 'FIXED',
      value: 50000, // ₹500 in paise
      currency: 'INR',
      active: true,
      usedCount: 0,
    });
  }

  /**
   * Initiates checkout for a flight result.
   *
   * Returns a Booking in PAYMENT_PENDING state. Caller should then initiate
   * the payment flow using the booking id and total amount.
   */
  async checkout(input: CheckoutInput): Promise<Booking> {
    const { resultToken, passengers, contact, validity, couponCode, userId } = input;

    // 1. Validate passengers
    if (!passengers || passengers.length === 0) {
      throw new CheckoutError('At least one passenger is required', 'passengers');
    }
    for (let i = 0; i < passengers.length; i++) {
      try {
        validatePassenger(passengers[i]);
      } catch (err) {
        if (err instanceof PassengerValidationError) {
          throw new CheckoutError(
            `Passenger ${i + 1}: ${err.message}`,
            `passengers[${i}].${err.field}`,
          );
        }
        throw err;
      }
    }

    // 2. Validate contact
    try {
      validateContact(contact);
    } catch (err) {
      if (err instanceof PassengerValidationError) {
        throw new CheckoutError(`Contact: ${err.message}`, `contact.${err.field}`);
      }
      throw err;
    }

    // 3. Revalidate flight result
    const flightResult = await this.flightSearchService.revalidate(resultToken);
    if (!flightResult) {
      throw new CheckoutError(
        'Flight result is no longer available or has expired. Please search again.',
        'resultToken',
      );
    }

    // 4. Passenger count: any positive count is accepted for launch scope.
    //    The earlier guard (step 1) already guarantees passengers.length >= 1.
    //    A stricter per-flight capacity rule can be added here when the
    //    provider contract exposes a maxPassengers field (follow-on scope).

    // 5. Resolve coupon
    let coupon: Coupon | undefined;
    if (couponCode) {
      coupon = this.coupons.get(couponCode.toUpperCase());
      if (!coupon) {
        throw new CheckoutError(`Coupon code '${couponCode}' is not valid`, 'couponCode');
      }
      // Validate the coupon (throws CouponError if invalid)
      try {
        computePricing({
          pricePerPassenger: flightResult.pricePerPassenger,
          passengerCount: passengers.length,
          coupon,
        });
      } catch (err) {
        if (err instanceof CouponError) {
          throw new CheckoutError(err.message, 'couponCode');
        }
        throw err;
      }
    }

    // 6. Compute pricing
    const pricing = computePricing({
      pricePerPassenger: flightResult.pricePerPassenger,
      passengerCount: passengers.length,
      coupon,
    });

    // 7. Create and activate reservation hold
    const reservation = this.reservationService.createReservation({
      flightResult,
      validity,
      userId,
    });

    const activeReservation = this.reservationService.activateReservation(reservation.id);
    const paymentPendingReservation = this.reservationService.transitionReservation(
      activeReservation.id,
      'PAYMENT_PENDING',
    );

    // 8. Build Booking record
    const now = new Date();
    const booking: Booking = {
      id: uuidv4(),
      reservation: paymentPendingReservation,
      passengers: [...passengers],
      contact,
      pricing,
      payment: null,
      status: 'PAYMENT_PENDING',
      createdAt: now,
      updatedAt: now,
    };

    this.bookings.set(booking.id, booking);

    // 9. Increment coupon usage (in-memory — production needs atomic DB update)
    if (coupon) {
      coupon.usedCount += 1;
    }

    return { ...booking };
  }

  /**
   * Retrieves a booking by ID.
   */
  getBooking(bookingId: string): Booking | null {
    const booking = this.bookings.get(bookingId);
    return booking ? { ...booking } : null;
  }

  /**
   * Confirms a booking after successful payment.
   * Updates reservation to CONFIRMED and booking to CONFIRMED.
   */
  confirmBooking(bookingId: string, providerPaymentId: string): Booking {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new CheckoutError(`Booking ${bookingId} not found`);
    }
    if (booking.status !== 'PAYMENT_PENDING') {
      throw new CheckoutError(
        `Cannot confirm booking in status ${booking.status}`,
      );
    }

    const confirmedReservation = this.reservationService.transitionReservation(
      booking.reservation.id,
      'CONFIRMED',
    );

    const confirmed: Booking = {
      ...booking,
      reservation: confirmedReservation,
      status: 'CONFIRMED',
      updatedAt: new Date(),
    };
    this.bookings.set(bookingId, confirmed);
    return { ...confirmed };
  }

  /**
   * Lists all bookings for a user.
   */
  listBookingsForUser(userId: string): Booking[] {
    return Array.from(this.bookings.values()).filter(
      (b) => b.reservation.userId === userId,
    );
  }
}
