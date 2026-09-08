import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlightSearchService } from '../../src/services/flightSearchService.js';
import { FlightSearchValidationError } from '../../src/domain/flight.js';
import type { FlightProvider } from '../../src/providers/flightProvider.js';
import type { FlightSearchResponse } from '../../src/domain/flight.js';

function makeMockProvider(overrides?: Partial<FlightProvider>): FlightProvider {
  return {
    searchFlights: vi.fn(async () => ({
      results: [],
      searchId: 'test-search-id',
      totalCount: 0,
    })),
    revalidate: vi.fn(async () => null),
    ...overrides,
  };
}

// A valid departure date: tomorrow
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

describe('FlightSearchService', () => {
  let provider: FlightProvider;
  let service: FlightSearchService;

  beforeEach(() => {
    provider = makeMockProvider();
    service = new FlightSearchService(provider);
  });

  describe('search() — validation', () => {
    it('rejects missing originCode', async () => {
      await expect(
        service.search({ originCode: '', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 1 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects invalid originCode (not 3 letters)', async () => {
      await expect(
        service.search({ originCode: 'XX', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 1 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects when origin equals destination', async () => {
      await expect(
        service.search({ originCode: 'DEL', destinationCode: 'DEL', departureDate: tomorrow(), passengerCount: 1 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects invalid departureDate format', async () => {
      await expect(
        service.search({ originCode: 'DEL', destinationCode: 'BOM', departureDate: '31-12-2025', passengerCount: 1 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects past departureDate', async () => {
      await expect(
        service.search({ originCode: 'DEL', destinationCode: 'BOM', departureDate: '2020-01-01', passengerCount: 1 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects passengerCount = 0', async () => {
      await expect(
        service.search({ originCode: 'DEL', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 0 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects passengerCount > 9', async () => {
      await expect(
        service.search({ originCode: 'DEL', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 10 }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('rejects empty airlineCode string', async () => {
      await expect(
        service.search({ originCode: 'DEL', destinationCode: 'BOM', departureDate: tomorrow(), passengerCount: 1, airlineCode: '' }),
      ).rejects.toThrow(FlightSearchValidationError);
    });

    it('accepts valid request and delegates to provider', async () => {
      const mockResponse: FlightSearchResponse = {
        results: [],
        searchId: 'abc',
        totalCount: 0,
      };
      (provider.searchFlights as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const result = await service.search({
        originCode: 'del',
        destinationCode: 'bom',
        departureDate: tomorrow(),
        passengerCount: 2,
      });

      expect(result).toEqual(mockResponse);
      expect(provider.searchFlights).toHaveBeenCalledWith({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 2,
        airlineCode: undefined,
      });
    });

    it('normalises codes to uppercase', async () => {
      await service.search({
        originCode: 'del',
        destinationCode: 'bom',
        departureDate: tomorrow(),
        passengerCount: 1,
      });
      const call = (provider.searchFlights as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.originCode).toBe('DEL');
      expect(call.destinationCode).toBe('BOM');
    });

    it('accepts optional airlineCode and passes it normalised', async () => {
      await service.search({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
        airlineCode: '6e',
      });
      const call = (provider.searchFlights as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.airlineCode).toBe('6E');
    });
  });

  describe('search() — provider error handling', () => {
    it('returns safe response when provider throws', async () => {
      (provider.searchFlights as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Provider unavailable'),
      );

      const result = await service.search({
        originCode: 'DEL',
        destinationCode: 'BOM',
        departureDate: tomorrow(),
        passengerCount: 1,
      });

      expect(result.results).toEqual([]);
      expect(result.providerError).toBe('Provider unavailable');
      expect(result.totalCount).toBe(0);
    });
  });

  describe('revalidate()', () => {
    it('returns null for falsy token', async () => {
      const result = await service.revalidate('');
      expect(result).toBeNull();
    });

    it('delegates non-empty token to provider', async () => {
      await service.revalidate('some-token');
      expect(provider.revalidate).toHaveBeenCalledWith('some-token');
    });
  });
});
