import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a different element (e.g. a Link) using Radix Slot. */
  asChild?: boolean;
  /** Show a spinner and disable interaction. */
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-text-onBrand hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-500/60',
  secondary:
    'bg-surface text-text border border-surface-border hover:bg-surface-muted disabled:bg-surface-muted disabled:text-text-muted',
  ghost:
    'bg-transparent text-text hover:bg-surface-muted disabled:text-text-muted',
  danger:
    'bg-danger-500 text-text-onBrand hover:bg-danger-500/90 disabled:bg-danger-500/60',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-base rounded-lg',
};

/**
 * Accessible button primitive.
 * - Focus outline satisfies WCAG 2.1 AA (via :focus-visible in globals.css).
 * - `aria-busy` communicates loading state to assistive tech.
 * - `disabled` short-circuits click without hiding the control from the tab order.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      asChild = false,
      isLoading = false,
      disabled,
      className,
      children,
      type,
      ...rest
    },
    ref,
  ) {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        // Only forward `type` if the underlying element is <button>; asChild
        // may render anchors etc. that must not receive a `type` attribute.
        {...(asChild ? {} : { type: type ?? 'button' })}
        aria-busy={isLoading || undefined}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors',
          'disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...rest}
      >
        {children}
      </Component>
    );
  },
);
