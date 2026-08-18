import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { StatusDot, type StatusTone } from './status-dot.js';

export interface AgendaEvent {
  id: string;
  /** Hora (ex: "14:30"). */
  time: string;
  /** Título. */
  title: ReactNode;
  /** Descrição/local. */
  description?: ReactNode;
  /** Tom do status. */
  tone?: StatusTone;
}

export interface AgendaDay {
  /** Data ISO (ex: "2025-10-15"). */
  date: string;
  /** Rótulo legível (ex: "Hoje, 15 out"). */
  label: string;
  /** Eventos do dia. */
  events: AgendaEvent[];
  /** Se é o dia de hoje. */
  isToday?: boolean;
}

export interface AgendaListProps {
  days: AgendaDay[];
  emptyMessage?: string;
  className?: string;
}

/* Spec §7: AgendaList — visão diária agrupada. Cada dia: label + lista de eventos.
   Evento: StatusDot 7px + time + título + descrição. Vazio = mensagem. */
export function AgendaList({ days, emptyMessage = 'Nenhum compromisso', className }: AgendaListProps) {
  const hasEvents = days.some((d) => d.events.length > 0);

  if (!hasEvents) {
    return (
      <div className={cn('bg-surface-2 rounded-card p-8 text-center', className)}>
        <p className="text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {days.map((day) => (
        <section key={day.date} className="space-y-2">
          <header className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold',
                day.isToday ? 'text-primary' : 'text-text',
              )}
            >
              {day.label}
            </span>
            {day.isToday ? (
              <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                Hoje
              </span>
            ) : null}
          </header>
          <div className="space-y-2 pl-2 border-l-border border-l ml-3">
            {day.events.map((event) => (
              <div key={event.id} className="relative ms-3 pb-2">
                <div className="absolute -left-3 top-1 flex h-4 w-4 items-center justify-center">
                  <StatusDot tone={event.tone ?? 'primary'} />
                </div>
                <div className="flex items-start gap-3">
                  <time className="text-text-muted text-xs font-medium tabular-nums shrink-0 w-16">
                    {event.time}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="text-text text-sm">{event.title}</p>
                    {event.description ? (
                      <p className="text-text-muted text-xs mt-0.5">{event.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}