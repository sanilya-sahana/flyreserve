/**
 * Reservation service — handles temporary reservation holds.
 *
 * Responsibilities:
 *  - Create a reservation hold against a validated flight result token.
 *  - Manage reservation lifecycle (hold → active → payment_pending → confirmed).
 *  - Schedule expiry per SAH-5 (48h or 14d validity).
 *  - Provide lookup and cancellation.
 *
 * This layer uses an in-memory store for the baseline (production will replace
 * with a persistent repository via SAH-21 / Data Engineering).
 *
 * Known gaps / blockers (recorded per SAH-20 scope):
 *  - Persistent store not yet wired — all data is lost on restart until
 *    SAH-21 delivers the data model and migration.
 *  - PNR / provider booking reference generation: the mock generates a fake
 *    PNR. Real PNR comes from the reservation consolidator contract (TBD,
 *    blocked by SAH-10 — provider selection criteria).
 *  - Expiry is computed at creation but active purging is not yet implemented;
 *    a background job or cron is needed (DevOps / Infrastructure).
 */

import { v4 as uuidv4 } from 'uuid';
import type { Reservation, ReservationValidity } from '../domain/reservation.js';
import { isValidTransition, TERMINAL_STATES } from '../domain/reservation.js';
import type { FlightResult } from '../domain/flight.js';

export class ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReservationError';
  }
}

function computeExpiresAt(validity: ReservationValidity): Date {
  const now = new Date();
  if (validity === '48h') {
    return new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }
  // 14d
  return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
}

function generatePnr(): string {
  // Mock PNR: 6 alphanumeric chars (real PNR comes from provider)
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export interface CreateReservationInput {
  flightResult: FlightResult;
  validity: ReservationValidity;
  /** User ID, or null for guest checkout */
  userId: string | null;
}

export class ReservationService {
  /** In-memory store: reservationId → Reservation */
  private readonly store = new Map<string, Reservation>();

  /**
   * Creates a new reservation hold in PENDING state.
   *
   * In production this will call the reservation provider to secure a PNR.
   * For now it generates a mock PNR and stores the hold locally.
   */
  createReservation(input: CreateReservationInput): Reservation {
    const { flightResult, validity, userId } = input;

    const now = new Date();
    const reservation: Reservation = {
      id: uuidv4(),
      providerReference: generatePnr(),
      airlineReference: undefined,
      status: 'PENDING',
      expiresAt: computeExpiresAt(validity),
      validity,
      createdAt: now,
      updatedAt: now,
      userId,
    };

    this.store.set(reservation.id, reservation);
    return { ...reservation };
  }

  /**
   * Transitions a reservation to a new status.
   * Validates the transition against the state machine.
   */
  transitionReservation(
    reservationId: string,
    toStatus: Reservation['status'],
  ): Reservation {
    const reservation = this.store.get(reservationId);
    if (!reservation) {
      throw new ReservationError(`Reservation ${reservationId} not found`);
    }

    if (!isValidTransition(reservation.status, toStatus)) {
      throw new ReservationError(
        `Invalid transition from ${reservation.status} to ${toStatus}`,
      );
    }

    const updated: Reservation = {
      ...reservation,
      status: toStatus,
      updatedAt: new Date(),
    };
    this.store.set(reservationId, updated);
    return { ...updated };
  }

  /**
   * Returns a reservation by ID.
   * Checks expiry and auto-transitions ACTIVE → EXPIRING if within 30 min of expiry.
   */
  getReservation(reservationId: string): Reservation | null {
    const reservation = this.store.get(reservationId);
    if (!reservation) return null;

    // Mark expiry if already past
    if (
      !TERMINAL_STATES.has(reservation.status) &&
      reservation.status !== 'EXPIRED' &&
      reservation.expiresAt <= new Date()
    ) {
      // Best-effort auto-expire
      try {
        return this.transitionReservation(reservationId, 'EXPIRED');
      } catch {
        // If transition is invalid from current state, return as-is
        return { ...reservation };
      }
    }

    return { ...reservation };
  }

  /**
   * Cancels a reservation if it is not in a terminal state.
   */
  cancelReservation(reservationId: string): Reservation {
    const reservation = this.store.get(reservationId);
    if (!reservation) {
      throw new ReservationError(`Reservation ${reservationId} not found`);
    }
    if (TERMINAL_STATES.has(reservation.status)) {
      throw new ReservationError(
        `Reservation ${reservationId} is already in terminal state ${reservation.status}`,
      );
    }
    return this.transitionReservation(reservationId, 'CANCELLED');
  }

  /** For use in checkout: marks reservation as ACTIVE after hold is confirmed. */
  activateReservation(reservationId: string): Reservation {
    return this.transitionReservation(reservationId, 'ACTIVE');
  }
}
