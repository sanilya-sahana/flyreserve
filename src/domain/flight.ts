/**
 * Flight search domain types.
 *
 * Derived from SAH-2 Module 1 (Flight Search) requirements.
 */

import { Money } from './payment.js';

export interface FlightSearchRequest {
  /** IATA airport code */
  originCode: string;
  /** IATA airport code */
  destinationCode: string;
  /** ISO-8601 date string (YYYY-MM-DD) */
  departureDate: string;
  /** Total passenger count (must be >= 1) */
  passengerCount: number;
  /** Optional IATA airline code filter */
  airlineCode?: string;
}

export interface FlightSegment {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  /** ISO-8601 datetime */
  departureAt: string;
  /** ISO-8601 datetime */
  arrivalAt: string;
  /** Duration in minutes */
  durationMinutes: number;
  stops: number;
  originCode: string;
  destinationCode: string;
}

export interface FlightResult {
  /** Provider-assigned result token (used for revalidation) */
  resultToken: string;
  segments: FlightSegment[];
  /** Price per passenger */
  pricePerPassenger: Money;
  /** Total price for all passengers */
  totalPrice: Money;
  /** Unique provider identifier for this flight/itinerary */
  providerItineraryId: string;
  /** When this result expires and must be revalidated */
  expiresAt: string;
}

export interface FlightSearchResponse {
  results: FlightResult[];
  searchId: string;
  /** Total number of results before any client-side filtering */
  totalCount: number;
  /** Whether the provider returned an error (partial results may still be present) */
  providerError?: string;
}

/** Thrown when a search request fails validation */
export class FlightSearchValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = 'FlightSearchValidationError';
  }
}
