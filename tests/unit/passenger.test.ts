import { describe, it, expect } from 'vitest';
import {
  validatePassenger,
  validateContact,
  PassengerValidationError,
  type Passenger,
  type BookingContact,
} from '../../src/domain/passenger.js';

const validPassenger: Passenger = {
  firstName: 'John',
  lastName: 'Doe',
  title: 'Mr',
  type: 'ADULT',
};

const validContact: BookingContact = {
  email: 'john.doe@example.com',
  phone: '+919876543210',
};

describe('validatePassenger', () => {
  it('accepts a valid adult passenger', () => {
    expect(() => validatePassenger(validPassenger)).not.toThrow();
  });

  it('throws on missing firstName', () => {
    expect(() => validatePassenger({ ...validPassenger, firstName: '' }))
      .toThrow(PassengerValidationError);
  });

  it('throws on missing lastName', () => {
    expect(() => validatePassenger({ ...validPassenger, lastName: '   ' }))
      .toThrow(PassengerValidationError);
  });

  it('throws on invalid title', () => {
    expect(() => validatePassenger({ ...validPassenger, title: 'Sir' as any }))
      .toThrow(PassengerValidationError);
  });

  it('accepts all valid titles', () => {
    const titles = ['Mr', 'Mrs', 'Ms', 'Dr', 'Master'] as const;
    for (const title of titles) {
      expect(() => validatePassenger({ ...validPassenger, title })).not.toThrow();
    }
  });

  it('throws on invalid dateOfBirth format', () => {
    expect(() => validatePassenger({ ...validPassenger, dateOfBirth: '01-01-1990' }))
      .toThrow(PassengerValidationError);
  });

  it('accepts valid dateOfBirth', () => {
    expect(() => validatePassenger({ ...validPassenger, dateOfBirth: '1990-01-15' })).not.toThrow();
  });

  it('throws on invalid nationality code', () => {
    expect(() => validatePassenger({ ...validPassenger, nationality: 'INDIA' }))
      .toThrow(PassengerValidationError);
  });

  it('accepts valid ISO-3166 alpha-2 nationality', () => {
    expect(() => validatePassenger({ ...validPassenger, nationality: 'IN' })).not.toThrow();
  });
});

describe('validateContact', () => {
  it('accepts a valid contact', () => {
    expect(() => validateContact(validContact)).not.toThrow();
  });

  it('throws on invalid email', () => {
    expect(() => validateContact({ ...validContact, email: 'not-an-email' }))
      .toThrow(PassengerValidationError);
  });

  it('throws on phone without + prefix', () => {
    expect(() => validateContact({ ...validContact, phone: '9876543210' }))
      .toThrow(PassengerValidationError);
  });

  it('throws on phone too short', () => {
    expect(() => validateContact({ ...validContact, phone: '+123' }))
      .toThrow(PassengerValidationError);
  });

  it('accepts US-format phone', () => {
    expect(() => validateContact({ ...validContact, phone: '+14155552671' })).not.toThrow();
  });
});
