/**
 * HTTP controller for flight search endpoints.
 *
 * Routes:
 *   POST /api/v1/flights/search      — search for available flights
 *   POST /api/v1/flights/revalidate  — revalidate a previously returned result
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { FlightSearchService } from '../services/flightSearchService.js';
import { FlightSearchValidationError } from '../domain/flight.js';

const SearchRequestSchema = z.object({
  originCode: z.string().min(1),
  destinationCode: z.string().min(1),
  departureDate: z.string().min(1),
  passengerCount: z.number().int().min(1).max(9),
  airlineCode: z.string().optional(),
});

const RevalidateRequestSchema = z.object({
  resultToken: z.string().min(1),
});

export function createFlightSearchRouter(service: FlightSearchService): Router {
  const router = Router();

  router.post('/search', async (req: Request, res: Response): Promise<void> => {
    const parsed = SearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const response = await service.search(parsed.data);
      res.json(response);
    } catch (err) {
      if (err instanceof FlightSearchValidationError) {
        res.status(400).json({ error: err.message, field: err.field });
        return;
      }
      console.error('Flight search error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/revalidate', async (req: Request, res: Response): Promise<void> => {
    const parsed = RevalidateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await service.revalidate(parsed.data.resultToken);
    if (!result) {
      res.status(404).json({ error: 'Result not found or expired' });
      return;
    }
    res.json(result);
  });

  return router;
}
