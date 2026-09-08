/**
 * HTTP controller for reservation endpoints.
 *
 * Routes:
 *   GET  /api/v1/reservations/:id        — get reservation by ID
 *   POST /api/v1/reservations/:id/cancel — cancel a reservation
 */

import { Router, type Request, type Response } from 'express';
import type { ReservationService } from '../services/reservationService.js';
import { ReservationError } from '../services/reservationService.js';

export function createReservationRouter(service: ReservationService): Router {
  const router = Router();

  router.get('/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Reservation ID is required' });
      return;
    }

    const reservation = service.getReservation(id);
    if (!reservation) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    res.json(reservation);
  });

  router.post('/:id/cancel', (req: Request, res: Response): void => {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Reservation ID is required' });
      return;
    }

    try {
      const cancelled = service.cancelReservation(id);
      res.json(cancelled);
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  return router;
}
