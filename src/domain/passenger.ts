/**
 * Passenger domain types.
 *
 * Derived from SAH-2 Module 2/3 requirements and SAH-3 (passenger data and
 * profile requirements).
 *
 * Launch scope: individual passenger details for one-way domestic/international
 * bookings. Multi-pax collections are arrays of Passenger at the booking level.
 */

/** Title options per SAH-3. */
export type PassengerTitle = 'Mr' | 'Mrs' | 'Ms' | 'Dr' | 'Master';

/** Passenger category per SAH-2. Only Adult is in scope at launch. */
export type PassengerType = 'ADULT';

/**
 * Core passenger data collected at checkout.
 * All fields are required by the provider for reservation hold.
 */
export interface Passenger {
  /** Given (first) name */
  firstName: string;
  /** Family (last) name */
  lastName: string;
  title: PassengerTitle;
  type: PassengerType;
  /** ISO-8601 date string (YYYY-MM-DD). Required for international travel. */
  dateOfBirth?: string;
  /** Nationality (ISO 3166-1 alpha-2 country code). Required for international travel. */
  nationality?: string;
  /** Passport number. Required for international travel. */
  passportNumber?: string;
  /** Passport expiry date (ISO-8601 YYYY-MM-DD). Required for international travel. */
  passportExpiry?: string;
}

/**
 * Contact details for the lead passenger / booking holder.
 * Used for ticket delivery and customer communications.
 */
export interface BookingContact {
  email: string;
  /** Phone in E.164 format (e.g. +91XXXXXXXXXX) */
  phone: string;
}

/** Thrown when passenger data fails validation */
export class PassengerValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = 'PassengerValidationError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_E164_RE = /^\+[1-9]\d{6,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

export function validatePassenger(p: Passenger): void {
  if (!p.firstName || p.firstName.trim().length === 0) {
    throw new PassengerValidationError('firstName is required', 'firstName');
  }
  if (!p.lastName || p.lastName.trim().length === 0) {
    throw new PassengerValidationError('lastName is required', 'lastName');
  }
  const validTitles: PassengerTitle[] = ['Mr', 'Mrs', 'Ms', 'Dr', 'Master'];
  if (!validTitles.includes(p.title)) {
    throw new PassengerValidationError(
      `title must be one of ${validTitles.join(', ')}`,
      'title',
    );
  }
  if (p.dateOfBirth !== undefined && !DATE_RE.test(p.dateOfBirth)) {
    throw new PassengerValidationError('dateOfBirth must be YYYY-MM-DD', 'dateOfBirth');
  }
  if (p.nationality !== undefined && !COUNTRY_CODE_RE.test(p.nationality)) {
    throw new PassengerValidationError(
      'nationality must be an ISO 3166-1 alpha-2 country code (e.g. IN)',
      'nationality',
    );
  }
  if (p.passportExpiry !== undefined && !DATE_RE.test(p.passportExpiry)) {
    throw new PassengerValidationError('passportExpiry must be YYYY-MM-DD', 'passportExpiry');
  }
}

export function validateContact(c: BookingContact): void {
  if (!c.email || !EMAIL_RE.test(c.email)) {
    throw new PassengerValidationError('email must be a valid email address', 'email');
  }
  if (!c.phone || !PHONE_E164_RE.test(c.phone)) {
    throw new PassengerValidationError(
      'phone must be in E.164 format (e.g. +91XXXXXXXXXX)',
      'phone',
    );
  }
}
