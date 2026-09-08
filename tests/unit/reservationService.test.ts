import { describe, it, expect } from 'vitest';
import { ReservationService, ReservationError } from '../../src/services/reservationService.js';
import type { FlightResult } from '../../src/domain/flight.js';

const mockFlightResult: FlightResult = {
  resultToken: 'mock-AI-DEL-BOM-0',
  providerItineraryId: 'test-itin-1',
  segments: [],
  pricePerPassenger: { amountMinorUnits: 350000, currency: 'INR' },
  totalPrice: { amountMinorUnits: 350000, currency: 'INR' },
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};

describe('ReservationService', () => {
  it('creates a reservation in PENDING state', () => {
    const service = new ReservationService();
    const reservation = service.createReservation({
      flightResult: mockFlightResult,
      validity: '48h',
      userId: null,
    });
    expect(reservation.status).toBe('PENDING');
    expect(reservation.id).toBeTruthy();
    expect(reservation.providerReference).toHaveLength(6);
    expect(reservation.userId).toBeNull();
  });

  it('sets expiresAt approximately 48h from now for 48h validity', () => {
    const service = new ReservationService();
    const before = Date.now();
    const reservation = service.createReservation({
      flightResult: mockFlightResult,
      validity: '48h',
      userId: 'user-1',
    });
    const after = Date.now();
    const expectedMs = 48 * 60 * 60 * 1000;
    expect(reservation.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
    expect(reservation.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
  });

  it('sets expiresAt approximately 14d from now for 14d validity', () => {
    const service = new ReservationService();
    const before = Date.now();
    const reservation = service.createReservation({
      flightResult: mockFlightResult,
      validity: '14d',
      userId: null,
    });
    const after = Date.now();
    const expectedMs = 14 * 24 * 60 * 60 * 1000;
    expect(reservation.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
    expect(reservation.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
  });

  it('allows PENDING -> ACTIVE transition', () => {
    const service = new ReservationService();
    const r = service.createReservation({ flightResult: mockFlightResult, validity: '48h', userId: null });
    const active = service.activateReservation(r.id);
    expect(active.status).toBe('ACTIVE');
  });

  it('allows ACTIVE -> PAYMENT_PENDING transition', () => {
    const service = new ReservationService();
    const r = service.createReservation({ flightResult: mockFlightResult, validity: '48h', userId: null });
    service.activateReservation(r.id);
    const pp = service.transitionReservation(r.id, 'PAYMENT_PENDING');
    expect(pp.status).toBe('PAYMENT_PENDING');
  });

  it('throws ReservationError on invalid transition', () => {
    const service = new ReservationService();
    const r = service.createReservation({ flightResult: mockFlightResult, validity: '48h', userId: null });
    expect(() => service.transitionReservation(r.id, 'CONFIRMED')).toThrow(ReservationError);
  });

  it('returns null for unknown reservation ID', () => {
    const service = new ReservationService();
    expect(service.getReservation('unknown-id')).toBeNull();
  });

  it('cancels a reservation in PENDING state', () => {
    const service = new ReservationService();
    const r = service.createReservation({ flightResult: mockFlightResult, validity: '48h', userId: null });
    const cancelled = service.cancelReservation(r.id);
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('throws when trying to cancel a terminal reservation', () => {
    const service = new ReservationService();
    const r = service.createReservation({ flightResult: mockFlightResult, validity: '48h', userId: null });
    service.cancelReservation(r.id);
    expect(() => service.cancelReservation(r.id)).toThrow(ReservationError);
  });
});
