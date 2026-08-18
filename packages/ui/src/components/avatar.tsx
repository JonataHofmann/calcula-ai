'use client';

import { useState } from 'react';
import { cn } from '../lib/cn.js';

export interface AvatarProps {
  src?: string;
  alt: string;
  name?: string;
  /** Spec §7 avatar scale: xs 24 · sm 28 · md 32 · lg 36. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[0.625rem]',
  sm: 'h-7 w-7 text-[0.6875rem]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-9 w-9 text-sm',
};

function initials(name?: string): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={cn(
        'bg-primary text-primary-foreground inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium',
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-label={alt} role="img">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
