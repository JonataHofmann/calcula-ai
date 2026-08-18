import { Avatar, type AvatarProps } from './avatar.js';
import { cn } from '../lib/cn.js';

export interface AvatarStackItem {
  src?: string;
  alt: string;
  name?: string;
}

export interface AvatarStackProps {
  items: AvatarStackItem[];
  /** Máximo visível antes do contador +N. Padrão 4 (§7). */
  max?: number;
  size?: AvatarProps['size'];
  className?: string;
}

/* Spec §7: sobreposição -8px, máx 4 + contador circular +N. Anel na cor da
   superfície separa os avatares empilhados. */
const overlap: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: '-ml-2',
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
};

const counterSize: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[0.625rem]',
  sm: 'h-7 w-7 text-[0.6875rem]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-9 w-9 text-sm',
};

export function AvatarStack({ items, max = 4, size = 'md', className }: AvatarStackProps) {
  const visible = items.slice(0, max);
  const rest = items.length - visible.length;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((item, index) => (
        <Avatar
          key={`${item.alt}-${index}`}
          {...item}
          size={size}
          className={cn('ring-surface ring-2', index > 0 && overlap[size])}
        />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            'bg-surface-2 text-text-muted ring-surface inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2',
            counterSize[size],
            overlap[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
