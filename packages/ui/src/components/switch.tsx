import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
}

/* Same accessible pattern as Checkbox: hidden real input drives a visual
   track+thumb via group-has-[:checked], so state/focus/disabled propagate
   without JS. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, id, ...props },
  ref,
) {
  const control = (
    <span className="group relative inline-flex h-5 w-9 shrink-0 items-center">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        role="switch"
        className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className="bg-border group-has-[:checked]:bg-primary group-has-[:focus-visible]:ring-focus-ring pointer-events-none flex h-5 w-9 items-center rounded-full transition-colors duration-150 group-has-[:focus-visible]:ring-2 group-has-[:disabled]:opacity-45"
      >
        <span className="ml-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 group-has-[:checked]:translate-x-4" />
      </span>
    </span>
  );

  if (!label) return <span className={className}>{control}</span>;

  return (
    <label
      htmlFor={id}
      className={cn('text-text inline-flex cursor-pointer items-center gap-2 text-sm', className)}
    >
      {control}
      {label}
    </label>
  );
});
