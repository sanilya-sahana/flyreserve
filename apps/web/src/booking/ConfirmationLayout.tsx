import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

/**
 * ConfirmationLayout — terminal post-purchase chrome.
 *
 * Deliberately does NOT render the booking-progress stepper. The wizard step
 * `aria-current="step"` semantic is reserved for the four pre-purchase steps
 * (search → select → passengers → checkout); rendering it here would tell a
 * screen-reader user they are back at "Search" after a successful purchase.
 * See SAH-38 finding F1.
 */
export function ConfirmationLayout(): JSX.Element {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-surface-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <NavLink
            to="/"
            className="text-lg font-semibold tracking-tight text-brand-700"
          >
            FlyReserve
          </NavLink>
          <p className="text-sm text-text-muted">Booking complete</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-surface-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-xs text-text-muted">
          <span>&copy; FlyReserve</span>
          <span>Support / Privacy / Terms</span>
        </div>
      </footer>
    </div>
  );
}
