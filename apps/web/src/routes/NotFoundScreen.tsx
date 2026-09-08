import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/design-system';

export function NotFoundScreen(): JSX.Element {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-text-muted">
        We couldn&apos;t find the page you were looking for.
      </p>
      <Button asChild>
        <Link to="/booking/search">Start a new search</Link>
      </Button>
    </section>
  );
}
