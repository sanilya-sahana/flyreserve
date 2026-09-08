/**
 * Coupon domain types.
 *
 * Derived from SAH-2 Module 3 (Checkout) and SAH-8 (pricing, fees, taxes, FX
 * rules) requirements.
 *
 * Launch scope: fixed-amount and percentage coupons in INR or USD.
 * Exclusions, stacking, and campaign management are NOT in launch scope.
 */

import type { Currency } from './payment.js';

export type CouponDiscountKind = 'FIXED' | 'PERCENT';

export interface Coupon {
  /** Coupon code (case-insensitive on lookup) */
  code: string;
  kind: CouponDiscountKind;
  /**
   * For FIXED: discount amount in minor units (same currency as booking).
   * For PERCENT: discount as integer percentage (1–100).
   */
  value: number;
  /** Currency for FIXED coupons. Ignored for PERCENT coupons. */
  currency?: Currency;
  /** Whether this coupon is currently active */
  active: boolean;
  /** ISO-8601 expiry date — coupon cannot be applied after this date. */
  expiresAt?: Date;
  /** Maximum number of times this coupon can be used (null = unlimited). */
  maxUses?: number;
  /** Current use count */
  usedCount: number;
}

/** Thrown when coupon validation fails */
export class CouponError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'CouponError';
  }
}
