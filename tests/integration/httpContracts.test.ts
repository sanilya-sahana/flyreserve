import { afterEach, describe, expect, it, vi } from 'vitest';
import request, { type Test } from 'supertest';
import { createApp } from '../../src/app.js';
import { ReservationService } from '../../src/services/reservationService.js';
import { CheckoutService } from '../../src/services/checkoutService.js';
import { FlightSearchService } from '../../src/services/flightSearchService.js';
import { MockFlightProvider } from '../../src/providers/mock/mockFlightProvider.js';
import type { Reservation } from '../../src/domain/reservation.js';

const userToken = 'user-123';
const internalToken = 'internal-secret';

const passenger = {
  firstName: 'Jane',
  lastName: 'Smith',
  title: 'Ms' as const,
  type: 'ADULT' as const,
  passportNumber: 'P1234567',
  dateOfBirth: '1990-01-01',
};

const contact = {
  email: 'jane@example.com',
  phone: '+919900112233',
};

function tomorrowDate(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function withAuth(test: Test, token = userToken): Test {
  return test.set('Authorization', `Bearer ${token}`);
}

async function searchResultToken(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app)
    .post('/api/v1/flights/search')
    .send({
      originCode: 'DEL',
      destinationCode: 'BOM',
      departureDate: tomorrowDate(),
      passengerCount: 1,
    });

  expect(response.status).toBe(200);
  expect(response.body.results).toHaveLength(4);
  return response.body.results[0].resultToken;
}

async function createBooking(app: ReturnType<typeof createApp>, token = userToken) {
  const resultToken = await searchResultToken(app);

  return withAuth(request(app).post('/api/v1/checkout'), token).send({
    resultToken,
    passengers: [passenger],
    contact,
    validity: '48h',
  });
}

describe('HTTP contract integration', () => {
  afterEach(() => {
    delete process.env['INTERNAL_API_SECRET'];
    vi.restoreAllMocks();
  });

  it('returns 201 with a PAYMENT_PENDING booking payload on checkout success', async () => {
    const app = createApp();

    const response = await createBooking(app);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: 'PAYMENT_PENDING',
      reservation: {
        id: expect.any(String),
        status: 'PAYMENT_PENDING',
        validity: '48h',
        userId: userToken,
      },
      passengers: [
        {
          firstName: 'Jane',
          lastName: 'Smith',
          title: 'Ms',
          type: 'ADULT',
        },
      ],
      contact,
      pricing: {
        couponCode: null,
        total: {
          amountMinorUnits: expect.any(Number),
          currency: 'INR',
        },
      },
      payment: null,
    });
    expect(response.body.passengers[0].passportNumber).toBeUndefined();
    expect(response.body.passengers[0].dateOfBirth).toBeUndefined();
  });

  it('returns 400 validation details for malformed checkout requests', async () => {
    const app = createApp();

    const response = await withAuth(request(app).post('/api/v1/checkout')).send({
      resultToken: '',
      passengers: [],
      contact: { email: 'not-an-email', phone: '123' },
      validity: '48h',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invalid request',
      details: {
        resultToken: expect.any(Array),
        passengers: expect.any(Array),
        contact: expect.any(Array),
      },
    });
  });

  it('returns 400 when checkout receives an expired or unknown result token', async () => {
    const app = createApp();

    const response = await withAuth(request(app).post('/api/v1/checkout')).send({
      resultToken: 'missing-token',
      passengers: [passenger],
      contact,
      validity: '48h',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Flight result is no longer available or has expired. Please search again.',
      field: 'resultToken',
    });
  });

  it('returns 200 for GET /api/v1/bookings/:id with the booking payload for the owner', async () => {
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).get(`/api/v1/bookings/${bookingResponse.body.id}`),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: bookingResponse.body.id,
      status: 'PAYMENT_PENDING',
      reservation: {
        id: expect.any(String),
        status: 'PAYMENT_PENDING',
      },
    });
  });

  it('returns 404 for unknown booking ids', async () => {
    const app = createApp();

    const response = await withAuth(request(app).get('/api/v1/bookings/unknown-booking'));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Booking not found' });
  });

  it('returns 403 when a different user requests someone else\'s booking', async () => {
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).get(`/api/v1/bookings/${bookingResponse.body.id}`),
      'other-user',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      detail: 'You do not have access to this booking.',
    });
  });

  it('returns 200 for POST /api/v1/bookings/:id/confirm with internal auth', async () => {
    process.env['INTERNAL_API_SECRET'] = internalToken;
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).post(`/api/v1/bookings/${bookingResponse.body.id}/confirm`),
      internalToken,
    ).send({ providerPaymentId: 'pi_test_payment_123' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: bookingResponse.body.id,
      status: 'CONFIRMED',
      reservation: {
        id: bookingResponse.body.reservation.id,
        status: 'CONFIRMED',
      },
    });
  });

  it('returns 400 for invalid booking confirm payloads', async () => {
    process.env['INTERNAL_API_SECRET'] = internalToken;
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).post(`/api/v1/bookings/${bookingResponse.body.id}/confirm`),
      internalToken,
    ).send({ providerPaymentId: '' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invalid request',
      details: {
        providerPaymentId: expect.any(Array),
      },
    });
  });

  it('returns 404 when confirming an unknown booking through the internal path', async () => {
    process.env['INTERNAL_API_SECRET'] = internalToken;
    const app = createApp();

    const response = await withAuth(
      request(app).post('/api/v1/bookings/unknown-booking/confirm'),
      internalToken,
    ).send({ providerPaymentId: 'pi_test_payment_123' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Booking unknown-booking not found' });
  });

  it('returns 200 for GET /api/v1/bookings and lists only the authenticated user\'s bookings', async () => {
    const app = createApp();

    await createBooking(app, 'user-abc');
    await createBooking(app, 'user-xyz');

    const response = await withAuth(request(app).get('/api/v1/bookings'), 'user-abc');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 1,
      bookings: [
        {
          reservation: {
            userId: 'user-abc',
          },
        },
      ],
    });
  });

  it('returns 200 for GET /api/v1/reservations/:id with the reservation payload for the owner', async () => {
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).get(`/api/v1/reservations/${bookingResponse.body.reservation.id}`),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: bookingResponse.body.reservation.id,
      status: 'PAYMENT_PENDING',
      providerReference: expect.any(String),
      validity: '48h',
    });
  });

  it('returns 404 for unknown reservation ids', async () => {
    const app = createApp();

    const response = await withAuth(request(app).get('/api/v1/reservations/unknown-reservation'));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Reservation not found' });
  });

  it('returns 403 when a different user requests someone else\'s reservation', async () => {
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).get(`/api/v1/reservations/${bookingResponse.body.reservation.id}`),
      'other-user',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      detail: 'You do not have access to this reservation.',
    });
  });

  it('returns 200 for POST /api/v1/reservations/:id/cancel and marks the reservation cancelled', async () => {
    const app = createApp();
    const bookingResponse = await createBooking(app);

    const response = await withAuth(
      request(app).post(`/api/v1/reservations/${bookingResponse.body.reservation.id}/cancel`),
    ).send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: bookingResponse.body.reservation.id,
      status: 'CANCELLED',
    });
  });

  it('returns 404 when cancelling an unknown reservation', async () => {
    const app = createApp();

    const response = await withAuth(
      request(app).post('/api/v1/reservations/unknown-reservation/cancel'),
    ).send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Reservation not found' });
  });

  it('surfaces expired reservations as EXPIRED through the API', async () => {
    const reservationService = new ReservationService();
    const seeded = reservationService.createReservation({
      flightResult: {
        resultToken: 'expired-token',
        providerItineraryId: 'expired-itinerary',
        segments: [],
        pricePerPassenger: { amountMinorUnits: 350000, currency: 'INR' },
        totalPrice: { amountMinorUnits: 350000, currency: 'INR' },
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      validity: '48h',
      userId: userToken,
    });

    const activeReservation = reservationService.activateReservation(seeded.id);
    const expiredReservation: Reservation = {
      ...activeReservation,
      expiresAt: new Date(Date.now() - 60_000),
    };
    (reservationService as unknown as { store: Map<string, Reservation> }).store.set(
      expiredReservation.id,
      expiredReservation,
    );

    const app = createApp({ reservationService });
    const response = await withAuth(
      request(app).get(`/api/v1/reservations/${expiredReservation.id}`),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: expiredReservation.id,
      status: 'EXPIRED',
    });
  });

  it('returns 500 JSON from the global error handler for unhandled route errors', async () => {
    const flightSearchService = new FlightSearchService(new MockFlightProvider());
    const reservationService = new ReservationService();
    const checkoutService = new CheckoutService(flightSearchService, reservationService);
    vi.spyOn(checkoutService, 'getBooking').mockImplementation(() => {
      throw new Error('boom from test');
    });

    const app = createApp({ flightSearchService, reservationService, checkoutService });
    const response = await withAuth(request(app).get('/api/v1/bookings/force-500'));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal server error',
      detail: 'boom from test',
    });
  });
});
