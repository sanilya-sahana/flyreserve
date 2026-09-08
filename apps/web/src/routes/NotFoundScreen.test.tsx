import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundScreen } from './NotFoundScreen';

describe('NotFoundScreen', () => {
  it('renders the page-not-found heading and a link back to search', () => {
    render(
      <MemoryRouter>
        <NotFoundScreen />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /Page not found/i }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Start a new search/i });
    expect(link).toHaveAttribute('href', '/booking/search');
  });
});
