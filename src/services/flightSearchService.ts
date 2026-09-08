/**
 * Flight Search service — the business-logic layer for Module 1.
 *
 * Validates the search request, delegates to the provider abstraction, and
 * normalises provider errors into predictable response shapes.
 *
 * Per SAH-2 Module 1 requirements:
 * - One-way search only (round-trip/multi-city are NOT in scope).
 * - Must validate distinct origin/destination, date, and passenger counts.
 * - Must handle no-results, provider errors, and stale/expired result cases.
 * - Results come through provider abstraction, not direct coupling.
 */

import type { FlightProvider } from '../providers/flightProvider.js';
import type { FlightSearchRequest, FlightSearchResponse } from '../domain/flight.js';
import { FlightSearchValidationError } from '../domain/flight.js';

const IATA_CODE_RE = /^[A-Z]{3}$/;

function validateRequest(req: FlightSearchRequest): void {
  if (!req.originCode || !IATA_CODE_RE.test(req.originCode.toUpperCase())) {
    throw new FlightSearchValidationError(
      'originCode must be a 3-letter IATA airport code',
      'originCode',
    );
  }
  if (!req.destinationCode || !IATA_CODE_RE.test(req.destinationCode.toUpperCase())) {
    throw new FlightSearchValidationError(
      'destinationCode must be a 3-letter IATA airport code',
      'destinationCode',
    );
  }
  if (req.originCode.toUpperCase() === req.destinationCode.toUpperCase()) {
    throw new FlightSearchValidationError(
      'originCode and destinationCode must be different airports',
      'destinationCode',
    );
  }
  if (!req.departureDate || !/^\d{4}-\d{2}-\d{2}$/.test(req.departureDate)) {
    throw new FlightSearchValidationError(
      'departureDate must be in YYYY-MM-DD format',
      'departureDate',
    );
  }
  const departureMs = new Date(req.departureDate).getTime();
  if (Number.isNaN(departureMs)) {
    throw new FlightSearchValidationError(
      'departureDate is not a valid date',
      'departureDate',
    );
  }
  // Allow same-day searches but not past dates
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (departureMs < todayStart.getTime()) {
    throw new FlightSearchValidationError(
      'departureDate must not be in the past',
      'departureDate',
    );
  }
  if (!Number.isInteger(req.passengerCount) || req.passengerCount < 1 || req.passengerCount > 9) {
    throw new FlightSearchValidationError(
      'passengerCount must be between 1 and 9',
      'passengerCount',
    );
  }
  if (req.airlineCode !== undefined && req.airlineCode !== null) {
    if (req.airlineCode.trim() === '') {
      throw new FlightSearchValidationError(
        'airlineCode must not be an empty string when provided',
        'airlineCode',
      );
    }
  }
}

export class FlightSearchService {
  constructor(private readonly provider: FlightProvider) {}

  async search(rawRequest: FlightSearchRequest): Promise<FlightSearchResponse> {
    // Normalise codes to uppercase before validation
    const request: FlightSearchRequest = {
      ...rawRequest,
      originCode: rawRequest.originCode?.toUpperCase(),
      destinationCode: rawRequest.destinationCode?.toUpperCase(),
      airlineCode: rawRequest.airlineCode?.toUpperCase(),
    };

    validateRequest(request);

    try {
      return await this.provider.searchFlights(request);
    } catch (err) {
      // Provider errors are caught here and turned into a safe response
      // rather than propagating as uncaught exceptions.
      const message = err instanceof Error ? err.message : 'Unknown provider error';
      return {
        results: [],
        searchId: '',
        totalCount: 0,
        providerError: message,
      };
    }
  }

  async revalidate(resultToken: string): Promise<FlightSearchResponse['results'][0] | null> {
    if (!resultToken || typeof resultToken !== 'string') {
      return null;
    }
    return this.provider.revalidate(resultToken);
  }
}
