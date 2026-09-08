/**
 * Flight provider abstraction.
 *
 * Per SAH-2 confirmed product decision #2: "Development will start with a
 * mock flight/reservation provider behind the same provider contract intended
 * for production."
 *
 * The production provider is TBD (SAH-10 tracks provider selection criteria).
 * All provider calls MUST go through this interface so the mock can be
 * swapped for a real consolidator without changing service or controller code.
 */

import type { FlightSearchRequest, FlightSearchResponse } from '../domain/flight.js';

export interface FlightProvider {
  /**
   * Search for available flights matching the request.
   * Returns results from the provider or an empty list with providerError set.
   */
  searchFlights(request: FlightSearchRequest): Promise<FlightSearchResponse>;

  /**
   * Revalidate price and availability for a previously returned result token.
   * Returns null if the flight is no longer available or the token is expired.
   */
  revalidate(resultToken: string): Promise<FlightSearchResponse['results'][0] | null>;
}
