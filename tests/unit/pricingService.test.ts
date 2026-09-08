import { describe, it, expect } from 'vitest';
import { computePricing } from '../../src/services/pricingService.js';
import { CouponError } from '../../src/domain/coupon.js';
import type { Coupon } from '../../src/domain/coupon.js';
import type { Money } from '../../src/domain/payment.js';

const inrPrice: Money = { amountMinorUnits: 350000, currency: 'INR' }; // ₹3500

describe('computePricing', () => {
  it('calculates base fare + service fee + tax with no coupon', () => {
    const result = computePricing({ pricePerPassenger: inrPrice, passengerCount: 1 });
    expect(result.baseFarePerPassenger).toEqual(inrPrice);
    expect(result.passengerCount).toBe(1);
    // baseFare = 350000, serviceFee = 29900, taxable = 379900, tax = round(379900 * 0.18) = 68382
    expect(result.serviceFee.amountMinorUnits).toBe(29900);
    expect(result.couponDiscount.amountMinorUnits).toBe(0);
    expect(result.tax.amountMinorUnits).toBe(Math.round(379900 * 0.18));
    expect(result.total.amountMinorUnits).toBe(379900 + Math.round(379900 * 0.18));
    expect(result.couponCode).toBeNull();
  });

  it('multiplies base fare by passenger count', () => {
    const result = computePricing({ pricePerPassenger: inrPrice, passengerCount: 2 });
    // baseFare = 700000, serviceFee = 29900, taxable = 729900
    expect(result.tax.amountMinorUnits).toBe(Math.round(729900 * 0.18));
    expect(result.total.amountMinorUnits).toBe(729900 + Math.round(729900 * 0.18));
  });

  it('applies PERCENT coupon correctly', () => {
    const coupon: Coupon = {
      code: 'SAVE10',
      kind: 'PERCENT',
      value: 10,
      active: true,
      usedCount: 0,
    };
    const result = computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon });
    // preDiscount = 350000 + 29900 = 379900; discount = floor(379900 * 10/100) = 37990
    expect(result.couponDiscount.amountMinorUnits).toBe(37990);
    expect(result.couponCode).toBe('SAVE10');
    const taxable = 379900 - 37990;
    expect(result.tax.amountMinorUnits).toBe(Math.round(taxable * 0.18));
    expect(result.total.amountMinorUnits).toBe(taxable + Math.round(taxable * 0.18));
  });

  it('applies FIXED coupon correctly', () => {
    const coupon: Coupon = {
      code: 'FLAT500',
      kind: 'FIXED',
      value: 50000,
      currency: 'INR',
      active: true,
      usedCount: 0,
    };
    const result = computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon });
    expect(result.couponDiscount.amountMinorUnits).toBe(50000);
    expect(result.couponCode).toBe('FLAT500');
  });

  it('caps coupon discount at preDiscount amount', () => {
    const coupon: Coupon = {
      code: 'HUGE',
      kind: 'FIXED',
      value: 9999999,
      currency: 'INR',
      active: true,
      usedCount: 0,
    };
    const result = computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon });
    const preDiscount = 350000 + 29900;
    expect(result.couponDiscount.amountMinorUnits).toBe(preDiscount);
    expect(result.total.amountMinorUnits).toBe(0); // taxable = 0, tax = 0, total = 0
  });

  it('throws CouponError for inactive coupon', () => {
    const coupon: Coupon = { code: 'DEAD', kind: 'PERCENT', value: 10, active: false, usedCount: 0 };
    expect(() => computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon }))
      .toThrow(CouponError);
  });

  it('throws CouponError for expired coupon', () => {
    const coupon: Coupon = {
      code: 'OLD',
      kind: 'PERCENT',
      value: 5,
      active: true,
      usedCount: 0,
      expiresAt: new Date('2020-01-01'),
    };
    expect(() => computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon }))
      .toThrow(CouponError);
  });

  it('throws CouponError when max uses reached', () => {
    const coupon: Coupon = {
      code: 'LIMITED',
      kind: 'PERCENT',
      value: 5,
      active: true,
      usedCount: 100,
      maxUses: 100,
    };
    expect(() => computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon }))
      .toThrow(CouponError);
  });

  it('throws CouponError for currency mismatch on FIXED coupon', () => {
    const coupon: Coupon = {
      code: 'USDONLY',
      kind: 'FIXED',
      value: 500,
      currency: 'USD',
      active: true,
      usedCount: 0,
    };
    expect(() => computePricing({ pricePerPassenger: inrPrice, passengerCount: 1, coupon }))
      .toThrow(CouponError);
  });

  it('respects a custom taxRate', () => {
    const result = computePricing({
      pricePerPassenger: inrPrice,
      passengerCount: 1,
      taxRate: 0.05,
    });
    const taxable = 350000 + 29900;
    expect(result.tax.amountMinorUnits).toBe(Math.round(taxable * 0.05));
    expect(result.taxRate).toBe(0.05);
  });
});
