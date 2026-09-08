import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
  type ReservationStatus,
} from '../../src/domain/reservation.js';

describe('Reservation state machine', () => {
  describe('isValidTransition', () => {
    it('allows PENDING -> ACTIVE', () => {
      expect(isValidTransition('PENDING', 'ACTIVE')).toBe(true);
    });

    it('allows PENDING -> CANCELLED', () => {
      expect(isValidTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('allows ACTIVE -> PAYMENT_PENDING', () => {
      expect(isValidTransition('ACTIVE', 'PAYMENT_PENDING')).toBe(true);
    });

    it('allows PAYMENT_PENDING -> CONFIRMED', () => {
      expect(isValidTransition('PAYMENT_PENDING', 'CONFIRMED')).toBe(true);
    });

    it('allows CONFIRMED -> REFUND_PENDING', () => {
      expect(isValidTransition('CONFIRMED', 'REFUND_PENDING')).toBe(true);
    });

    it('allows REFUND_PENDING -> REFUNDED', () => {
      expect(isValidTransition('REFUND_PENDING', 'REFUNDED')).toBe(true);
    });

    it('rejects PENDING -> CONFIRMED (skipping steps)', () => {
      expect(isValidTransition('PENDING', 'CONFIRMED')).toBe(false);
    });

    it('rejects EXPIRED -> ACTIVE (from terminal)', () => {
      expect(isValidTransition('EXPIRED', 'ACTIVE')).toBe(false);
    });

    it('rejects CANCELLED -> ACTIVE (from terminal)', () => {
      expect(isValidTransition('CANCELLED', 'ACTIVE')).toBe(false);
    });

    it('rejects REFUNDED -> any state (terminal)', () => {
      const allStatuses = Object.keys(VALID_TRANSITIONS) as ReservationStatus[];
      allStatuses.forEach((to) => {
        expect(isValidTransition('REFUNDED', to)).toBe(false);
      });
    });

    it('rejects self-transitions for all terminal states', () => {
      for (const state of TERMINAL_STATES) {
        expect(isValidTransition(state, state)).toBe(false);
      }
    });
  });

  describe('TERMINAL_STATES', () => {
    it('contains EXPIRED, CANCELLED, REISSUED, REFUNDED', () => {
      expect(TERMINAL_STATES.has('EXPIRED')).toBe(true);
      expect(TERMINAL_STATES.has('CANCELLED')).toBe(true);
      expect(TERMINAL_STATES.has('REISSUED')).toBe(true);
      expect(TERMINAL_STATES.has('REFUNDED')).toBe(true);
    });

    it('terminal states have no outgoing transitions', () => {
      for (const state of TERMINAL_STATES) {
        expect(VALID_TRANSITIONS[state]).toEqual([]);
      }
    });
  });
});
