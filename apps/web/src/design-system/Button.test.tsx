import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders as a native button by default with type="button"', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('honors a caller-supplied type', () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('marks aria-busy and disables interaction when isLoading', async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Loading
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Loading' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders via Slot when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', '/x');
    // asChild should not carry a button type attribute onto <a>.
    expect(link).not.toHaveAttribute('type');
  });

  it('applies variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toMatch(
      /bg-danger-500/,
    );
  });
});
