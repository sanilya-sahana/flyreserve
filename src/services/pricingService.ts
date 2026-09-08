/**
 * Pricing service — computes checkout totals.
 *
 * Implements the pricing model from SAH-8:
 *  1. Base fare = pricePerPassenger × passengerCount
 *  2. Service fee (flat per booking, configurable)
 *  3. Coupon discount applied after service fee, before tax
 *     - Discount cannot exceed (baseFare + serviceFee)
 *  4. Tax = taxRate × (baseFare + serviceFee − couponDiscount)
 *     - Tax is always inclusive in the displayed total (exclusive calc, added on top)
 *  5. Total = baseFare + serviceFee − couponDiscount + tax
 *
 * All amounts are in minor units of the booking currency (paise for INR, cents for USD).
 *
 * Known gaps / blockers (recorded per SAH-20 scope):
 *  - FX conversion (INR↔USD) not yet implemented: SAH-8 requires an FX-rate
 *    source and rounding rules that are not yet decided. Multi-currency checkout
 *    is blocked until that contract is published.
 *  - Tax jurisdiction: launch tax rate defaulted to 18% (Indian GST proxy).
 *    Jurisdiction-specific logic is a follow-on once SAH-8 is fully approved.
 *  - Coupon repository is in-memory; production will need persistent store with
 *    atomically-incremented usedCount.
 */

import type { Money, Currency } from '../domain/payment.js';
import type { Coupon } from '../domain/coupon.js';
import type { PricingSnapshot } from '../domain/booking.js';
import { CouponError } from '../domain/coupon.js';

/** Default tax rate (18% GST proxy for INR launch). */
const DEFAULT_TAX_RATE = 0.18;

/** Service fee in INR minor units (paise). Configurable per environment. */
const SERVICE_FEE_INR_MINOR = 29900; // ₹299
/** Service fee in USD minor units (cents). */
const SERVICE_FEE_USD_MINOR = 399; // $3.99

function serviceFee(currency: Currency): Money {
  return {
    amountMinorUnits: currency === 'USD' ? SERVICE_FEE_USD_MINOR : SERVICE_FEE_INR_MINOR,
    currency,
  };
}

function zeroMoney(currency: Currency): Money {
  return { amountMinorUnits: 0, currency };
}

/**
 * Validates and computes the discount from a coupon.
 *
 * @param coupon        - The coupon to apply
 * @param preDiscountAmount - Amount (minor units) before discount (baseFare + serviceFee)
 * @param currency      - Booking currency
 * @returns discount Money
 * @throws CouponError if the coupon is invalid or expired
 */
function computeCouponDiscount(
  coupon: Coupon,
  preDiscountAmount: number,
  currency: Currency,
): Money {
  if (!coupon.active) {
    throw new CouponError('Coupon is not active', coupon.code);
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new CouponError('Coupon has expired', coupon.code);
  }
  if (coupon.maxUses !== undefined && coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new CouponError('Coupon has reached its usage limit', coupon.code);
  }

  let discountMinor: number;

  if (coupon.kind === 'FIXED') {
    // Fixed coupon must match booking currency
    if (coupon.currency && coupon.currency !== currency) {
      throw new CouponError(
        `Coupon is only valid for ${coupon.currency} bookings`,
        coupon.code,
      );
    }
    discountMinor = coupon.value;
  } else {
    // PERCENT
    if (coupon.value < 1 || coupon.value > 100) {
      throw new CouponError('Coupon percentage value must be between 1 and 100', coupon.code);
    }
    discountMinor = Math.floor((preDiscountAmount * coupon.value) / 100);
  }

  // Discount cannot exceed the pre-discount subtotal
  discountMinor = Math.min(discountMinor, preDiscountAmount);

  return { amountMinorUnits: discountMinor, currency };
}

export interface PricingInput {
  /** Price per passenger in minor units */
  pricePerPassenger: Money;
  passengerCount: number;
  /** Optional coupon to apply */
  coupon?: Coupon;
  /** Tax rate as a decimal — defaults to DEFAULT_TAX_RATE */
  taxRate?: number;
}

/**
 * Computes a PricingSnapshot for a booking.
 * Pure function — no side effects, no coupon usedCount mutation.
 */
export function computePricing(input: PricingInput): PricingSnapshot {
  const { pricePerPassenger, passengerCount, coupon, taxRate = DEFAULT_TAX_RATE } = input;
  const currency = pricePerPassenger.currency;

  const baseFareMinor = pricePerPassenger.amountMinorUnits * passengerCount;
  const fee = serviceFee(currency);
  const preDiscountMinor = baseFareMinor + fee.amountMinorUnits;

  let discount = zeroMoney(currency);
  let couponCode: string | null = null;

  if (coupon) {
    discount = computeCouponDiscount(coupon, preDiscountMinor, currency);
    couponCode = coupon.code;
  }

  const taxableMinor = preDiscountMinor - discount.amountMinorUnits;
  const taxMinor = Math.round(taxableMinor * taxRate);
  const totalMinor = taxableMinor + taxMinor;

  return {
    baseFarePerPassenger: pricePerPassenger,
    passengerCount,
    serviceFee: fee,
    couponDiscount: discount,
    tax: { amountMinorUnits: taxMinor, currency },
    total: { amountMinorUnits: totalMinor, currency },
    couponCode,
    taxRate,
  };
}
