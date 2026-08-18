import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

/* Spec §7: surface, r-card, sh-card, padding 20. Separação por sombra — sem
   borda dura. `hover` opcional aplica sh-hover + translateY(-1px). */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-card shadow-card',
        hover &&
          'transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-hover',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-text font-display text-[0.9375rem] font-semibold', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}
