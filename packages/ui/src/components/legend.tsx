import { StatusDot, type StatusTone } from './status-dot.js';
import { cn } from '../lib/cn.js';

export interface LegendItem {
  tone: StatusTone;
  label: string;
}

export interface LegendProps {
  items: LegendItem[];
  className?: string;
}

/* Spec §7: StatusDot + rótulo 13 text-2, itens espaçados. Rótulo carrega o
   significado — cor nunca é o único indicador (§10). */
export function Legend({ items, className }: LegendProps) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-6 gap-y-2', className)}>
      {items.map((item) => (
        <li key={item.label} className="text-text-muted flex items-center gap-2 text-[0.8125rem]">
          <StatusDot tone={item.tone} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
