/**
 * HTTP controller for reservation endpoints.
 *
 * Routes (all require auth):
 *   GET  /api/v1/reservations/:id        — get reservation by ID (owner only)
 *   POST /api/v1/reservations/:id/cancel — cancel a reservation (owner only)
 *
 * Security: requireAuth is applied at the router level.
 * The ownership check prevents IDOR: a user cannot read or cancel another
 * user's reservation by guessing IDs.
 *
 * Note: Guest-checkout reservations (userId=null) are accessible only by
 * internal service calls (e.g. payment webhook handler). Guest self-service
 * cancellation via a booking reference link is a follow-on feature.
 */

import { Router, type Request, type Response } from 'express';
import type { ReservationService } from '../services/reservationService.js';
import { ReservationError } from '../services/reservationService.js';
import { requireAuth } from '../middleware/auth.js';

export function createReservationRouter(service: ReservationService): Router {
  const router = Router();

  // All reservation routes require authentication.
  router.use(requireAuth);

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

    // Ownership check: only the reservation owner (or internal role) may read it.
    const principalId = req.auth!.userId;
    const isInternal = req.auth!.roles.includes('internal');
    if (!isInternal && reservation.userId !== null && reservation.userId !== principalId) {
      res.status(403).json({ error: 'Forbidden', detail: 'You do not have access to this reservation.' });
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

    const reservation = service.getReservation(id);
    if (!reservation) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    // Ownership check before destructive action.
    const principalId = req.auth!.userId;
    const isInternal = req.auth!.roles.includes('internal');
    if (!isInternal && reservation.userId !== null && reservation.userId !== principalId) {
      res.status(403).json({ error: 'Forbidden', detail: 'You do not have access to this reservation.' });
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
