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

export interface AppDependencies {
  flightSearchService?: FlightSearchService;
  reservationService?: ReservationService;
  checkoutService?: CheckoutService;
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();

  app.use(express.json());

  // Health check — DevOps liveness probe
  // Returns status, version, uptime (seconds), and ISO timestamp for monitoring systems.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // Wire provider and services
  const flightProvider = new MockFlightProvider();
  const flightSearchService = dependencies.flightSearchService ?? new FlightSearchService(flightProvider);
  const reservationService = dependencies.reservationService ?? new ReservationService();
  const checkoutService = dependencies.checkoutService ?? new CheckoutService(flightSearchService, reservationService);

  // Mount routers
  app.use('/api/v1/flights', createFlightSearchRouter(flightSearchService));
  app.use('/api/v1/reservations', createReservationRouter(reservationService));
  app.use('/api/v1/checkout', createCheckoutRouter(checkoutService));
  app.use('/api/v1/bookings', createBookingRouter(checkoutService));

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
