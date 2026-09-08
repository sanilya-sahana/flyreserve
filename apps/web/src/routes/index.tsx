import { createBrowserRouter, Navigate } from 'react-router-dom';

import { BookingLayout } from '@/booking/BookingLayout';
import { SearchScreen } from '@/booking/SearchScreen';
import { SelectFlightScreen } from '@/booking/SelectFlightScreen';
import { PassengersScreen } from '@/booking/PassengersScreen';
import { CheckoutScreen } from '@/booking/CheckoutScreen';
import { ConfirmationScreen } from '@/booking/ConfirmationScreen';
import { NotFoundScreen } from '@/routes/NotFoundScreen';

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
      { path: 'booking/confirmation', element: <ConfirmationScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);
