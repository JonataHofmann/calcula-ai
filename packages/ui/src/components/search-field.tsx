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
        className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
      />
      <input
        type="search"
        onKeyDown={handleKeyDown}
        className={cn(
          'bg-surface text-text placeholder:text-text-muted border-border h-10 w-full rounded-md border pr-3 pl-9 text-sm transition-colors',
          'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
        {...props}
      />
    </div>
  );
}
