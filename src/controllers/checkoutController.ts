/**
 * HTTP controller for checkout and booking endpoints.
 *
 * Routes (all require auth unless noted):
 *   POST /api/v1/checkout              — initiate checkout (returns booking in PAYMENT_PENDING)
 *   GET  /api/v1/bookings/:id          — get booking by ID (own booking only)
 *   POST /api/v1/bookings/:id/confirm  — confirm booking after payment (internal/webhook only)
 *   GET  /api/v1/bookings              — list own bookings (derived from auth, not query param)
 *
 * Security: requireAuth is applied at the router level so every booking endpoint
 * requires authentication. The confirm endpoint additionally requires an internal
 * token via requireInternalAuth because it must only be called by the payment
 * provider webhook handler, not by end users.
 *
 * Auth stubs: full JWT verification is blocked on SAH-16 (infra/Cybersecurity).
 * The current stubs enforce the correct rejection shape and will be upgraded in place.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CheckoutService } from '../services/checkoutService.js';
import { CheckoutError } from '../services/checkoutService.js';
import { requireAuth, requireInternalAuth } from '../middleware/auth.js';
import type { Booking } from '../domain/booking.js';

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
});

const ConfirmBookingSchema = z.object({
  providerPaymentId: z.string().min(1),
});

/**
 * Builds a safe booking response: strips sensitive PII fields (passport, DOB)
 * from passenger entries. Contact email is retained for booking confirmation
 * UX; passport data is not.
 *
 * Full field-level access control (role-gated passport visibility for airline
 * operations) is a follow-on once the auth model is defined.
 */
function safeBookingResponse(booking: Booking): unknown {
  return {
    ...booking,
    passengers: booking.passengers.map(({ passportNumber: _pn, dateOfBirth: _dob, ...rest }) => rest),
  };
}

export function createCheckoutRouter(service: CheckoutService): Router {
  const router = Router();

  /**
   * POST /api/v1/checkout
   * Initiates checkout. Returns a Booking in PAYMENT_PENDING state.
   * Auth: user session required (userId derived from auth context).
   */
  router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const parsed = CheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    // Derive userId from authenticated principal, not from request body.
    const userId = req.auth!.userId === 'dev-bypass-user' ? null : req.auth!.userId;

    try {
      const booking = await service.checkout({ ...parsed.data, userId });
      res.status(201).json(safeBookingResponse(booking));
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

  // All booking routes require authentication.
  router.use(requireAuth);

  /**
   * GET /api/v1/bookings/:id
   * Returns the booking if it belongs to the authenticated user.
   * Prevents IDOR: cross-user lookups are rejected with 403.
   */
  router.get('/:id', (req: Request, res: Response): void => {
    const booking = service.getBooking(req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Ownership check: only the booking owner (or internal role) may read it.
    const principalId = req.auth!.userId;
    const isInternal = req.auth!.roles.includes('internal');
    if (!isInternal && booking.reservation.userId !== principalId) {
      res.status(403).json({ error: 'Forbidden', detail: 'You do not have access to this booking.' });
      return;
    }

    res.json(safeBookingResponse(booking));
  });

  /**
   * POST /api/v1/bookings/:id/confirm
   * Confirms a booking after successful payment.
   *
   * This endpoint must ONLY be called by the payment provider webhook handler,
   * not by end users. It is protected by requireInternalAuth in addition to
   * the base requireAuth applied at router level.
   *
   * The additional requireInternalAuth check ensures end-user tokens cannot
   * self-confirm a booking — preventing a critical trust-boundary bypass
   * where a user could mark their own booking as paid without actual payment.
   */
  router.post('/:id/confirm', requireInternalAuth, (req: Request, res: Response): void => {
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
      res.json(safeBookingResponse(confirmed));
    } catch (err) {
      if (err instanceof CheckoutError) {
        const status = err.notFound ? 404 : 400;
        res.status(status).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  /**
   * GET /api/v1/bookings
   * Lists bookings for the authenticated user.
   * The userId is derived from the auth context — NOT from a query parameter —
   * preventing the IDOR identified in the security review (SAH-34).
   */
  router.get('/', (req: Request, res: Response): void => {
    const userId = req.auth!.userId;
    const bookings = service.listBookingsForUser(userId);
    res.json({ bookings: bookings.map(safeBookingResponse), total: bookings.length });
  });

  return router;
}
