import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-2 motion-reduce:animate-none animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
