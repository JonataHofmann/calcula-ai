import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helpText?: string;
  error?: string;
}

export function Input({ label, helpText, error, className, id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : helpText ? helpId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-text text-sm font-medium">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'bg-surface text-text placeholder:text-text-subtle rounded-btn h-10 border px-3.5 text-sm transition-colors',
          'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-45',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-danger text-sm">
          {error}
        </p>
      ) : helpText ? (
        <p id={helpId} className="text-text-muted text-sm">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
