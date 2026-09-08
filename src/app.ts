/**
 * Express application factory.
 * Separated from index.ts so the app can be imported in integration tests
 * without starting the HTTP server.
 */

import express from 'express';
import { createFlightSearchRouter } from './controllers/flightSearchController.js';
import { createReservationRouter } from './controllers/reservationController.js';
import { createCheckoutRouter, createBookingRouter } from './controllers/checkoutController.js';
import { FlightSearchService } from './services/flightSearchService.js';
import { ReservationService } from './services/reservationService.js';
import { CheckoutService } from './services/checkoutService.js';
import { MockFlightProvider } from './providers/mock/mockFlightProvider.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // Wire provider and services
  const flightProvider = new MockFlightProvider();
  const flightSearchService = new FlightSearchService(flightProvider);
  const reservationService = new ReservationService();
  const checkoutService = new CheckoutService(flightSearchService, reservationService);

  // Mount routers
  app.use('/api/v1/flights', createFlightSearchRouter(flightSearchService));
  app.use('/api/v1/reservations', createReservationRouter(reservationService));
  app.use('/api/v1/checkout', createCheckoutRouter(checkoutService));
  app.use('/api/v1/bookings', createBookingRouter(checkoutService));

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
