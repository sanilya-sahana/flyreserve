import { describe, it, expect, beforeEach } from 'vitest';
import { CheckoutService, CheckoutError } from '../../src/services/checkoutService.js';
import { ReservationService } from '../../src/services/reservationService.js';
import { FlightSearchService } from '../../src/services/flightSearchService.js';
import { MockFlightProvider } from '../../src/providers/mock/mockFlightProvider.js';
import type { CheckoutInput } from '../../src/services/checkoutService.js';

const validInput: CheckoutInput = {
  resultToken: 'mock-AI-DEL-BOM-0',
  passengers: [
    { firstName: 'Jane', lastName: 'Smith', title: 'Ms', type: 'ADULT' },
  ],
  contact: { email: 'jane@example.com', phone: '+919900112233' },
  validity: '48h',
  userId: null,
};

async function getValidToken(service: FlightSearchService): Promise<string> {
  const result = await service.search({
    originCode: 'DEL',
    destinationCode: 'BOM',
    departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    passengerCount: 1,
  });
  return result.results[0].resultToken;
}

describe('CheckoutService', () => {
  let flightService: FlightSearchService;
  let reservationService: ReservationService;
  let checkoutService: CheckoutService;

  beforeEach(() => {
    const provider = new MockFlightProvider();
    flightService = new FlightSearchService(provider);
    reservationService = new ReservationService();
    checkoutService = new CheckoutService(flightService, reservationService);
  });

  it('creates a booking in PAYMENT_PENDING state', async () => {
    const token = await getValidToken(flightService);
    const booking = await checkoutService.checkout({ ...validInput, resultToken: token });
    expect(booking.status).toBe('PAYMENT_PENDING');
    expect(booking.id).toBeTruthy();
    expect(booking.reservation.status).toBe('PAYMENT_PENDING');
    expect(booking.pricing.couponCode).toBeNull();
    expect(booking.payment).toBeNull();
  });

  it('applies a valid PERCENT coupon', async () => {
    const token = await getValidToken(flightService);
    const booking = await checkoutService.checkout({
      ...validInput,
      resultToken: token,
      couponCode: 'WELCOME10',
    });
    expect(booking.pricing.couponCode).toBe('WELCOME10');
    expect(booking.pricing.couponDiscount.amountMinorUnits).toBeGreaterThan(0);
  });

  it('applies a valid FIXED coupon', async () => {
    const token = await getValidToken(flightService);
    const booking = await checkoutService.checkout({
      ...validInput,
      resultToken: token,
      couponCode: 'FLAT500',
    });
    expect(booking.pricing.couponCode).toBe('FLAT500');
    expect(booking.pricing.couponDiscount.amountMinorUnits).toBe(50000);
  });

  it('throws CheckoutError for invalid coupon code', async () => {
    const token = await getValidToken(flightService);
    await expect(
      checkoutService.checkout({ ...validInput, resultToken: token, couponCode: 'FAKE' }),
    ).rejects.toThrow(CheckoutError);
  });

  it('throws CheckoutError for expired/invalid result token', async () => {
    await expect(
      checkoutService.checkout({ ...validInput, resultToken: 'does-not-exist' }),
    ).rejects.toThrow(CheckoutError);
  });

  it('throws CheckoutError when no passengers provided', async () => {
    const token = await getValidToken(flightService);
    await expect(
      checkoutService.checkout({ ...validInput, resultToken: token, passengers: [] }),
    ).rejects.toThrow(CheckoutError);
  });

  it('throws CheckoutError for invalid passenger firstName', async () => {
    const token = await getValidToken(flightService);
    await expect(
      checkoutService.checkout({
        ...validInput,
        resultToken: token,
        passengers: [{ firstName: '', lastName: 'X', title: 'Mr', type: 'ADULT' }],
      }),
    ).rejects.toThrow(CheckoutError);
  });

  it('retrieves a booking by ID', async () => {
    const token = await getValidToken(flightService);
    const booking = await checkoutService.checkout({ ...validInput, resultToken: token });
    expect(checkoutService.getBooking(booking.id)).not.toBeNull();
  });

  it('returns null for unknown booking ID', () => {
    expect(checkoutService.getBooking('unknown-id')).toBeNull();
  });

  it('confirms a booking and transitions reservation to CONFIRMED', async () => {
    const token = await getValidToken(flightService);
    const booking = await checkoutService.checkout({ ...validInput, resultToken: token });
    const confirmed = checkoutService.confirmBooking(booking.id, 'pi_test_payment_123');
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.reservation.status).toBe('CONFIRMED');
  });

  it('throws on confirming a non-PAYMENT_PENDING booking', async () => {
    const token = await getValidToken(flightService);
    const booking = await checkoutService.checkout({ ...validInput, resultToken: token });
    checkoutService.confirmBooking(booking.id, 'pi_test_1');
    expect(() => checkoutService.confirmBooking(booking.id, 'pi_test_2')).toThrow(CheckoutError);
  });

  it('lists bookings for a specific userId', async () => {
    const token1 = await getValidToken(flightService);
    const token2 = await getValidToken(flightService);
    await checkoutService.checkout({ ...validInput, resultToken: token1, userId: 'user-abc' });
    await checkoutService.checkout({ ...validInput, resultToken: token2, userId: 'user-xyz' });
    const forAbc = checkoutService.listBookingsForUser('user-abc');
    expect(forAbc).toHaveLength(1);
    expect(forAbc[0].reservation.userId).toBe('user-abc');
  });

  // Regression: SAH-37 — the old guard at lines 139-142 compared passengers.length
  // to pricePerPassenger.amountMinorUnits and ALSO required passengers.length < 1,
  // making the entire branch permanently unreachable.  These tests confirm that
  // multiple valid passengers are accepted and that the pricing snapshot correctly
  // records the passenger count.
  it('accepts two passengers without error (SAH-37 regression)', async () => {
    const token = await getValidToken(flightService);
    const twoPassengers = [
      { firstName: 'Jane', lastName: 'Smith', title: 'Ms' as const, type: 'ADULT' as const },
      { firstName: 'John', lastName: 'Smith', title: 'Mr' as const, type: 'ADULT' as const },
    ];
    const booking = await checkoutService.checkout({
      ...validInput,
      resultToken: token,
      passengers: twoPassengers,
    });
    expect(booking.status).toBe('PAYMENT_PENDING');
    expect(booking.passengers).toHaveLength(2);
  });

  it('pricing snapshot records correct passenger count for multi-passenger booking (SAH-37 regression)', async () => {
    const token = await getValidToken(flightService);
    const twoPassengers = [
      { firstName: 'Jane', lastName: 'Smith', title: 'Ms' as const, type: 'ADULT' as const },
      { firstName: 'John', lastName: 'Smith', title: 'Mr' as const, type: 'ADULT' as const },
    ];
    const booking = await checkoutService.checkout({
      ...validInput,
      resultToken: token,
      passengers: twoPassengers,
    });
    // pricing.passengerCount must match the actual passenger list length.
    expect(booking.pricing.passengerCount).toBe(2);
    // Base fare must be 2× the per-passenger price (no coupon, flat service fee excluded).
    const expectedBaseFare = booking.pricing.baseFarePerPassenger.amountMinorUnits * 2;
    // Derive baseFare = total - serviceFee - tax + couponDiscount
    const derivedBaseFare =
      booking.pricing.total.amountMinorUnits -
      booking.pricing.serviceFee.amountMinorUnits -
      booking.pricing.tax.amountMinorUnits +
      booking.pricing.couponDiscount.amountMinorUnits;
    expect(derivedBaseFare).toBe(expectedBaseFare);
  });
});
