import type { JSX } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { BOOKING_STEPS, currentStepIndex } from './steps';

export function BookingLayout(): JSX.Element {
  const { pathname } = useLocation();
  const activeIndex = currentStepIndex(pathname);

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
          <p className="text-sm text-text-muted">Secure booking</p>
        </div>
      </header>

      <nav
        aria-label="Booking progress"
        className="border-b border-surface-border bg-surface"
      >
        <ol className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-6 py-3 text-sm">
          {BOOKING_STEPS.map((step, idx) => {
            const isActive = idx === activeIndex;
            const isDone = idx < activeIndex;
            return (
              <li key={step.path} className="flex items-center gap-2">
                <span
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'inline-flex h-7 items-center rounded-full px-3',
                    isActive && 'bg-brand-500 text-text-onBrand',
                    isDone && 'bg-brand-100 text-brand-700',
                    !isActive && !isDone && 'bg-surface-muted text-text-muted',
                  )}
                >
                  {step.shortLabel}
                </span>
                {idx < BOOKING_STEPS.length - 1 ? (
                  <span aria-hidden="true" className="text-text-muted">
                    /
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

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
