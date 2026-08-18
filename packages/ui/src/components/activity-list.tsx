import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Avatar, type AvatarProps } from './avatar.js';

export interface ActivityItem {
  id: string;
  /** Avatar do autor. */
  avatar?: AvatarProps;
  /** Texto principal (ex: "João criou a meta..."). */
  primary: ReactNode;
  /** Texto secundário (timestamp). */
  secondary?: ReactNode;
  /** Ação/meta à direita. */
  action?: ReactNode;
}

export interface ActivityListProps {
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}

/* Spec §7: ActivityList — feed cronológico. Cada item: avatar 32 + texto + action.
   Divide-border entre itens. Vazio = ilustração + mensagem. */
export function ActivityList({ items, emptyMessage = 'Nenhuma atividade recente', className }: ActivityListProps) {
  if (items.length === 0) {
    return (
      <div className={cn('bg-surface-2 rounded-card p-8 text-center', className)}>
        <p className="text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('divide-border divide-y', className)}>
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 py-3">
          <Avatar {...item.avatar} size="md" alt={item.avatar?.alt ?? 'Avatar'} />
          <div className="min-w-0 flex-1">
            <p className="text-text text-sm">{item.primary}</p>
            {item.secondary ? <p className="text-text-muted text-xs mt-0.5">{item.secondary}</p> : null}
          </div>
          {item.action ? <div className="shrink-0">{item.action}</div> : null}
        </div>
      ))}
    </div>
  );
}