import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { StatusDot, type StatusTone } from './status-dot.js';

export interface TimelineEvent {
  id: string;
  /** Rótulo de tempo (ex: "14:30"). */
  time: string;
  /** Título do evento. */
  title: ReactNode;
  /** Descrição/entidade. */
  description?: ReactNode;
  /** Tom do ponto na linha. */
  tone?: StatusTone;
  /** Ícone opcional no ponto. */
  icon?: ReactNode;
}

export interface TimelineTrackProps {
  events: TimelineEvent[];
  className?: string;
}

/* Spec §7: TimelineTrack — linha vertical com pontos (StatusDot 10px). Fundo surface, linha text-subtle.
   Evento: ponto + time + título + descrição. */
export function TimelineTrack({ events, className }: TimelineTrackProps) {
  return (
    <div className={cn('relative pl-6', className)}>
      {/* Linha central */}
      <span className="bg-text-subtle absolute left-[5px] top-0 bottom-0 w-[2px]" aria-hidden="true" />
      <div className="space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Ponto na linha */}
            <div className="relative flex-shrink-0 w-12 items-start justify-center">
              <StatusDot
                tone={event.tone ?? 'primary'}
                className="relative z-10 h-[10px] w-[10px]"
              />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline gap-2">
                <time className="text-text-muted text-xs font-medium tabular-nums shrink-0">
                  {event.time}
                </time>
                <p className="text-text text-sm font-medium">{event.title}</p>
              </div>
              {event.description ? (
                <p className="text-text-muted text-xs mt-0.5 ml-14">{event.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}