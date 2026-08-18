import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helpText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  helpText,
  error,
  options,
  placeholder,
  className,
  id,
  defaultValue,
  value,
  ...props
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const helpId = `${selectId}-help`;
  const errorId = `${selectId}-error`;
  const describedBy = error ? errorId : helpText ? helpId : undefined;
  const resolvedDefault =
    value === undefined && defaultValue === undefined && placeholder ? '' : defaultValue;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-text text-sm font-medium">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        value={value}
        defaultValue={resolvedDefault}
        className={cn(
          'bg-surface text-text rounded-btn h-10 border px-3.5 text-sm transition-colors',
          'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-45',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
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
