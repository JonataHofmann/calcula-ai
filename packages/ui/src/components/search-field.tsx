'use client';

import { Search } from 'lucide-react';
import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import { cn } from '../lib/cn.js';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export function SearchField({ onSearch, className, onKeyDown, ...props }: SearchFieldProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.key === 'Enter') {
      onSearch?.(event.currentTarget.value);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden="true"
        className="text-text-subtle pointer-events-none absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2"
      />
      <input
        type="search"
        onKeyDown={handleKeyDown}
        className={cn(
          'bg-surface-2 text-text placeholder:text-text-subtle h-12 w-full rounded-full pr-4 pl-11 text-sm transition-colors',
          'focus:bg-surface focus-visible:ring-primary-soft focus-visible:ring-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-45',
        )}
        {...props}
      />
    </div>
  );
}
