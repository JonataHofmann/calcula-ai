import { cn } from '../lib/cn.js';

export interface MetaItem {
  label: string;
  value: string | number;
  /** Se verdadeiro, destaca o valor. */
  highlighted?: boolean;
  /** Tooltip/ajuda. */
  help?: string;
}

export interface MetaRowProps {
  /** Título do grupo. */
  title?: string;
  /** Itens (2-4 por linha). */
  items: MetaItem[];
  className?: string;
}

/* Spec §7: MetaRow — linha de metadados (key/value). Grid responsivo 2/4 colunas.
   Label text-2 muted, value text-1 (highlighted = bold). Gap 4/6. */
export function MetaRow({ title, items, className }: MetaRowProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {title ? <h4 className="text-text-muted text-xs font-semibold uppercase tracking-wider">{title}</h4> : null}
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-text-subtle text-[0.75rem]">{item.label}</span>
            <span
              className={cn(
                'text-text font-medium tabular-nums',
                item.highlighted && 'font-semibold',
              )}
            >
              {item.value}
            </span>
            {item.help ? (
              <span className="text-text-subtle text-[0.6875rem]">{item.help}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}