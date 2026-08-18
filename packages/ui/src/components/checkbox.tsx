import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
}

/* Spec §7: círculo 20, borda 1.75 text-3; marcado = check índigo, sem preencher.
   Input real fica visualmente escondido mas acessível; estado propaga via
   group-has-[:checked] para o box e o check (que é aninhado, não irmão direto). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const control = (
    <span className="group relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className="border-text-subtle group-has-[:checked]:border-primary group-has-[:focus-visible]:ring-focus-ring pointer-events-none flex h-5 w-5 items-center justify-center rounded-full border-[1.75px] transition-colors duration-150 group-has-[:focus-visible]:ring-2 group-has-[:disabled]:opacity-45"
      >
        <Check
          className="text-primary h-3 w-3 opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100"
          strokeWidth={3}
        />
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
