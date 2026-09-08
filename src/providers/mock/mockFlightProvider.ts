/**
 * Mock flight provider — used in development and tests.
 *
 * Implements FlightProvider using deterministic, in-memory data.
 * The mock returns plausible results so the rest of the system can
 * be developed and tested without a live reservation consolidator.
 */

import { v4 as uuidv4 } from 'uuid';
import type { FlightProvider } from '../flightProvider.js';
import type {
  FlightSearchRequest,
  FlightSearchResponse,
  FlightResult,
} from '../../domain/flight.js';

const MOCK_AIRLINES = [
  { code: 'AI', name: 'Air India' },
  { code: '6E', name: 'IndiGo' },
  { code: 'UK', name: 'Vistara' },
  { code: 'SG', name: 'SpiceJet' },
];

function addHours(dateStr: string, hours: number): string {
  const d = new Date(dateStr);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function buildResult(request: FlightSearchRequest, airlineIdx: number): FlightResult {
  const airline = MOCK_AIRLINES[airlineIdx % MOCK_AIRLINES.length];
  const departureAt = `${request.departureDate}T${String(6 + airlineIdx * 2).padStart(2, '0')}:00:00.000Z`;
  const durationMinutes = 120 + airlineIdx * 30;
  const arrivalAt = addHours(departureAt, durationMinutes / 60);
  const priceMinorUnits = (3500 + airlineIdx * 750) * 100; // paise
  const total = priceMinorUnits * request.passengerCount;
  const resultToken = `mock-${airline.code}-${request.originCode}-${request.destinationCode}-${airlineIdx}`;

  return {
    resultToken,
    providerItineraryId: uuidv4(),
    segments: [
      {
        airline: airline.name,
        airlineCode: airline.code,
        flightNumber: `${airline.code}${100 + airlineIdx * 111}`,
        departureAt,
        arrivalAt,
        durationMinutes,
        stops: 0,
        originCode: request.originCode,
        destinationCode: request.destinationCode,
      },
    ],
    pricePerPassenger: { amountMinorUnits: priceMinorUnits, currency: 'INR' },
    totalPrice: { amountMinorUnits: total, currency: 'INR' },
    expiresAt: addHours(departureAt, 24),
  };
}

export class MockFlightProvider implements FlightProvider {
  /** Cached results by resultToken for revalidation */
  private readonly cache = new Map<string, FlightResult>();

  async searchFlights(request: FlightSearchRequest): Promise<FlightSearchResponse> {
    const results: FlightResult[] = [];

    const airlines = request.airlineCode
      ? MOCK_AIRLINES.filter((a) => a.code === request.airlineCode!.toUpperCase())
      : MOCK_AIRLINES;

    if (airlines.length === 0) {
      return {
        results: [],
        searchId: uuidv4(),
        totalCount: 0,
        providerError: undefined,
      };
    }

    for (let i = 0; i < airlines.length; i++) {
      const result = buildResult(request, i);
      this.cache.set(result.resultToken, result);
      results.push(result);
    }

    return {
      results,
      searchId: uuidv4(),
      totalCount: results.length,
    };
  }

  async revalidate(resultToken: string): Promise<FlightResult | null> {
    const cached = this.cache.get(resultToken);
    if (!cached) return null;

    // In the mock, tokens never expire — real provider will enforce expiry.
    return { ...cached, providerItineraryId: uuidv4() };
  }
}
