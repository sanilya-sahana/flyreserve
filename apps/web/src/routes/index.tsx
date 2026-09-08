import { createBrowserRouter, Navigate } from 'react-router-dom';

import { BookingLayout } from '@/booking/BookingLayout';
import { ConfirmationLayout } from '@/booking/ConfirmationLayout';
import { SearchScreen } from '@/booking/SearchScreen';
import { SelectFlightScreen } from '@/booking/SelectFlightScreen';
import { PassengersScreen } from '@/booking/PassengersScreen';
import { CheckoutScreen } from '@/booking/CheckoutScreen';
import { ConfirmationScreen } from '@/booking/ConfirmationScreen';
import { NotFoundScreen } from '@/routes/NotFoundScreen';

/**
 * Router table.
 *
 * Two sibling layouts:
 * - BookingLayout: pre-purchase wizard steps (search → select → passengers → checkout).
 *   Renders the progress stepper.
 * - ConfirmationLayout: post-purchase terminal state. Deliberately omits the
 *   stepper — see SAH-38 F1 and ConfirmationLayout.tsx.
 *
 * Unknown paths fall through to NotFoundScreen under BookingLayout; that
 * layout hides the stepper when currentStepIndex(pathname) === -1.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <BookingLayout />,
    children: [
      { index: true, element: <Navigate to="/booking/search" replace /> },
      { path: 'booking/search', element: <SearchScreen /> },
      { path: 'booking/select', element: <SelectFlightScreen /> },
      { path: 'booking/passengers', element: <PassengersScreen /> },
      { path: 'booking/checkout', element: <CheckoutScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
  {
    path: '/booking/confirmation',
    element: <ConfirmationLayout />,
    children: [{ index: true, element: <ConfirmationScreen /> }],
  },
]);
