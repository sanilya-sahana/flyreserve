import { describe, it, expect } from 'vitest';
import {
  isValidPaymentTransition,
  VALID_PAYMENT_TRANSITIONS,
  type PaymentStatus,
} from '../../src/domain/payment.js';

describe('Payment state machine', () => {
  describe('isValidPaymentTransition', () => {
    it('allows CREATED -> PROCESSING', () => {
      expect(isValidPaymentTransition('CREATED', 'PROCESSING')).toBe(true);
    });

    it('allows CREATED -> REQUIRES_ACTION', () => {
      expect(isValidPaymentTransition('CREATED', 'REQUIRES_ACTION')).toBe(true);
    });

    it('allows PROCESSING -> SUCCEEDED', () => {
      expect(isValidPaymentTransition('PROCESSING', 'SUCCEEDED')).toBe(true);
    });

    it('allows PROCESSING -> FAILED', () => {
      expect(isValidPaymentTransition('PROCESSING', 'FAILED')).toBe(true);
    });

    it('allows SUCCEEDED -> REFUND_PENDING', () => {
      expect(isValidPaymentTransition('SUCCEEDED', 'REFUND_PENDING')).toBe(true);
    });

    it('allows REFUND_PENDING -> REFUNDED', () => {
      expect(isValidPaymentTransition('REFUND_PENDING', 'REFUNDED')).toBe(true);
    });

    it('rejects FAILED -> any state (terminal)', () => {
      const allStatuses = Object.keys(VALID_PAYMENT_TRANSITIONS) as PaymentStatus[];
      allStatuses.forEach((to) => {
        expect(isValidPaymentTransition('FAILED', to)).toBe(false);
      });
    });

    it('rejects REFUNDED -> any state (terminal)', () => {
      const allStatuses = Object.keys(VALID_PAYMENT_TRANSITIONS) as PaymentStatus[];
      allStatuses.forEach((to) => {
        expect(isValidPaymentTransition('REFUNDED', to)).toBe(false);
      });
    });

    it('rejects CANCELLED -> PROCESSING', () => {
      expect(isValidPaymentTransition('CANCELLED', 'PROCESSING')).toBe(false);
    });
  });

  describe('Terminal payment states', () => {
    const terminals: PaymentStatus[] = ['FAILED', 'CANCELLED', 'REFUNDED'];

    it('have empty transition arrays', () => {
      for (const s of terminals) {
        expect(VALID_PAYMENT_TRANSITIONS[s]).toEqual([]);
      }
    });
  });
});
