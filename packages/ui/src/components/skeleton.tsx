import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-border/60 animate-pulse rounded-md', className)} {...props} />;
}
