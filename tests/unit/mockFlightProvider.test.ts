import { describe, it, expect } from 'vitest';
import { MockFlightProvider } from '../../src/providers/mock/mockFlightProvider.js';

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

describe('MockFlightProvider', () => {
  describe('searchFlights()', () => {
    it('returns results for a valid request', async () => {
      const provider = new MockFlightProvider();
      const response = await provider.searchFlights({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
      });

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.totalCount).toBe(response.results.length);
    });

    it('assigns unique result tokens to each result', async () => {
      const provider = new MockFlightProvider();
      const response = await provider.searchFlights({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
      });

      const tokens = response.results.map((r) => r.resultToken);
      const unique = new Set(tokens);
      expect(unique.size).toBe(tokens.length);
    });

    it('filters by airlineCode when provided', async () => {
      const provider = new MockFlightProvider();
      const response = await provider.searchFlights({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
        airlineCode: 'AI',
      });

      expect(response.results.length).toBeGreaterThan(0);
      for (const result of response.results) {
        expect(result.segments[0].airlineCode).toBe('AI');
      }
    });

    it('returns empty results for unknown airlineCode', async () => {
      const provider = new MockFlightProvider();
      const response = await provider.searchFlights({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
        airlineCode: 'ZZ',
      });

      expect(response.results).toEqual([]);
      expect(response.totalCount).toBe(0);
    });

    it('multiplies price by passenger count', async () => {
      const provider = new MockFlightProvider();
      const [single, multi] = await Promise.all([
        provider.searchFlights({ originCode: 'DEL', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 1 }),
        provider.searchFlights({ originCode: 'DEL', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 3 }),
      ]);

      const singleFirst = single.results[0];
      const multiFirst = multi.results[0];

      expect(multiFirst.totalPrice.amountMinorUnits).toBe(
        singleFirst.pricePerPassenger.amountMinorUnits * 3,
      );
    });

    it('returns INR currency', async () => {
      const provider = new MockFlightProvider();
      const response = await provider.searchFlights({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
      });

      for (const r of response.results) {
        expect(r.pricePerPassenger.currency).toBe('INR');
        expect(r.totalPrice.currency).toBe('INR');
      }
    });
  });

  describe('revalidate()', () => {
    it('returns null for an unknown token', async () => {
      const provider = new MockFlightProvider();
      const result = await provider.revalidate('nonexistent-token');
      expect(result).toBeNull();
    });

    it('returns the result for a valid cached token', async () => {
      const provider = new MockFlightProvider();
      const response = await provider.searchFlights({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
      });

      const token = response.results[0].resultToken;
      const revalidated = await provider.revalidate(token);
      expect(revalidated).not.toBeNull();
      expect(revalidated!.segments[0].originCode).toBe('DEL');
    });
  });
});
