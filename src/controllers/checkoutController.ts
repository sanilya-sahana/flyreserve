/**
 * HTTP controller for checkout and booking endpoints.
 *
 * Routes:
 *   POST /api/v1/checkout            — initiate checkout (returns booking in PAYMENT_PENDING)
 *   GET  /api/v1/bookings/:id        — get booking by ID
 *   POST /api/v1/bookings/:id/confirm — confirm booking after payment (mock payment flow)
 *   GET  /api/v1/bookings            — list bookings for a user (requires userId query param)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CheckoutService } from '../services/checkoutService.js';
import { CheckoutError } from '../services/checkoutService.js';

const PassengerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  title: z.enum(['Mr', 'Mrs', 'Ms', 'Dr', 'Master']),
  type: z.literal('ADULT').default('ADULT'),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
});

const ContactSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7),
});

const CheckoutRequestSchema = z.object({
  resultToken: z.string().min(1),
  passengers: z.array(PassengerSchema).min(1).max(9),
  contact: ContactSchema,
  validity: z.enum(['48h', '14d']).default('48h'),
  couponCode: z.string().optional(),
  userId: z.string().nullable().default(null),
});

const ConfirmBookingSchema = z.object({
  providerPaymentId: z.string().min(1),
});

export function createCheckoutRouter(service: CheckoutService): Router {
  const router = Router();

  /**
   * POST /api/v1/checkout
   * Initiates checkout. Returns a Booking in PAYMENT_PENDING state.
   */
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const parsed = CheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const booking = await service.checkout(parsed.data);
      res.status(201).json(booking);
    } catch (err) {
      if (err instanceof CheckoutError) {
        res.status(400).json({ error: err.message, field: err.field });
        return;
      }
      throw err;
    }
  });

  return router;
}

export function createBookingRouter(service: CheckoutService): Router {
  const router = Router();

  /**
   * GET /api/v1/bookings/:id
   */
  router.get('/:id', (req: Request, res: Response): void => {
    const booking = service.getBooking(req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.json(booking);
  });

  /**
   * POST /api/v1/bookings/:id/confirm
   * Called after payment succeeds. In production this will be triggered by the
   * payment provider webhook (Stripe/PayPal). For now it accepts a manual call.
   */
  router.post('/:id/confirm', (req: Request, res: Response): void => {
    const parsed = ConfirmBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const confirmed = service.confirmBooking(req.params.id, parsed.data.providerPaymentId);
      res.json(confirmed);
    } catch (err) {
      if (err instanceof CheckoutError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  /**
   * GET /api/v1/bookings?userId=<id>
   */
  router.get('/', (req: Request, res: Response): void => {
    const { userId } = req.query;
    if (typeof userId !== 'string' || !userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }
    const bookings = service.listBookingsForUser(userId);
    res.json({ bookings, total: bookings.length });
  });

  return router;
}
