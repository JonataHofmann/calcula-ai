import { cn } from '../lib/cn.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export interface MiniCalendarProps {
  /** Mês atual (0-11). */
  month: number;
  /** Ano atual. */
  year: number;
  /** Dias com marcação (ISO string). */
  markedDays?: string[];
  /** Dia selecionado (ISO string). */
  selectedDay?: string;
  /** Callback ao clicar um dia. */
  onDayClick?: (iso: string) => void;
  /** Callback mudança de mês. */
  onMonthChange?: (month: number, year: number) => void;
  className?: string;
}

/* Spec §7: MiniCalendar — calendário compacto p/ sidebar/painel. Fundo surface, r-card.
   Cabeçalho: nav mês + label. Grid 7 colunas. Dias marcados = ponto primário. Selecionado = pill primário. */
export function MiniCalendar({
  month,
  year,
  markedDays = [],
  selectedDay,
  onDayClick,
  onMonthChange,
  className,
}: MiniCalendarProps) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function iso(day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function handlePrev() {
    const d = new Date(year, month - 1, 1);
    onMonthChange?.(d.getMonth(), d.getFullYear());
  }
  function handleNext() {
    const d = new Date(year, month + 1, 1);
    onMonthChange?.(d.getMonth(), d.getFullYear());
  }

  return (
    <div className={cn('bg-surface rounded-card p-3', className)}>
      <header className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Mês anterior"
          className="text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-focus-ring flex h-8 w-8 items-center justify-center rounded-icon transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-text text-sm font-medium capitalize">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={handleNext}
          aria-label="Próximo mês"
          className="text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-focus-ring flex h-8 w-8 items-center justify-center rounded-icon transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </header>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-text-subtle flex h-7 items-center justify-center text-xs font-medium">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const cellIso = iso(day);
          const isToday = cellIso === todayIso;
          const isSelected = cellIso === selectedDay;
          const isMarked = markedDays.includes(cellIso);

          return (
            <button
              key={cellIso}
              type="button"
              onClick={() => onDayClick?.(cellIso)}
              aria-label={cellIso}
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex h-8 w-full items-center justify-center rounded-icon text-sm transition-colors',
                'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
                isSelected
                  ? 'bg-primary text-primary-foreground font-medium'
                  : isToday
                  ? 'bg-primary-soft text-primary font-medium'
                  : 'text-text hover:bg-surface-2',
              )}
            >
              {day}
              {isMarked && !isSelected && !isToday && (
                <span className="bg-primary absolute bottom-1 h-1.5 w-1.5 rounded-full" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}