import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional short helper text shown below the input. */
  hint?: ReactNode;
  /** Error message. When set, the field is marked invalid and error text is announced. */
  error?: string;
  /** Adornment rendered inside the field (e.g. currency symbol). */
  leadingAddon?: ReactNode;
}

/**
 * Accessible labelled input primitive.
 * - Label is always associated via htmlFor/id (Radix Label).
 * - aria-invalid + aria-describedby wire error and hint to screen readers.
 * - Never hides the label visually; keep it above the field for booking-flow clarity.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, leadingAddon, id, className, required, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <LabelPrimitive.Root
        htmlFor={inputId}
        className="text-sm font-medium text-text"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger-500">
            *
          </span>
        ) : null}
      </LabelPrimitive.Root>
      <div
        className={cn(
          'flex items-center rounded-md border bg-surface transition-colors',
          error ? 'border-danger-500' : 'border-surface-border',
          'focus-within:border-brand-500',
        )}
      >
        {leadingAddon ? (
          <span className="pl-3 pr-2 text-sm text-text-muted" aria-hidden="true">
            {leadingAddon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-muted',
            leadingAddon ? 'pl-0' : '',
            className,
          )}
          {...rest}
        />
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger-500">
          {error}
        </p>
      ) : null}
    </div>
  );
});
