'use client';

import { findCardBrand, type CategoryNodeDto, type CategoryTreeDto } from '@finance/contracts';
import {
  Button,
  EntitySelect,
  Input,
  Select,
  Switch,
  type EntityOption,
  type SelectOption,
} from '@finance/ui';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { AccountLike, CardLike } from './transaction-form-modal';
import type { TransactionFilters } from './transactions-ui.slice';

export interface TransactionsFiltersProps {
  filters: TransactionFilters;
  onChange: (patch: TransactionFilters) => void;
  onClear: () => void;
  categories?: CategoryTreeDto;
  accounts: AccountLike[];
  cards: CardLike[];
  groupCreditCardExpenses: boolean;
  onGroupCreditCardExpensesChange: (value: boolean) => void;
  showOverdue: boolean;
  onShowOverdueChange: (value: boolean) => void;
}

/** Flattens the category tree into indented options. */
function flatten(nodes: CategoryNodeDto[], depth = 0): EntityOption[] {
  const out: EntityOption[] = [];
  for (const node of nodes) {
    out.push({ value: node.id, label: node.name, icon: node.icon, color: node.color, depth });
    if (node.children.length > 0) out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

const RECURRENCE_OPTIONS: SelectOption[] = [
  { value: 'single', label: 'Avulsa' },
  { value: 'fixed', label: 'Fixa' },
  { value: 'installment', label: 'Parcelada' },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
];

/** Empty string from a Select/Input clears that filter. */
function orUndef(value: string): string | undefined {
  return value === '' ? undefined : value;
}

export function TransactionsFilters({
  filters,
  onChange,
  onClear,
  categories,
  accounts,
  cards,
  groupCreditCardExpenses,
  onGroupCreditCardExpensesChange,
  showOverdue,
  onShowOverdueChange,
}: TransactionsFiltersProps) {
  // "Todas/Todos" first so the filter can be cleared back to no selection.
  const categoryOptions: EntityOption[] = [
    { value: '', label: 'Todas' },
    ...(categories ? [...flatten(categories.expense), ...flatten(categories.income)] : []),
  ];
  const accountOptions: EntityOption[] = [
    { value: '', label: 'Todas' },
    ...accounts.map((a) => ({
      value: a.id,
      label: a.name,
      icon: a.icon ?? 'wallet',
      color: a.color,
    })),
  ];
  const cardOptions: EntityOption[] = [
    { value: '', label: 'Todos' },
    ...cards.map((c) => {
      const brand = c.brandId ? findCardBrand(c.brandId) : undefined;
      return {
        value: c.id,
        label: c.name,
        icon: 'credit-card' as const,
        colorHex: brand?.color,
        hint: c.lastDigits ? `•••• ${c.lastDigits}` : undefined,
      };
    }),
  ];

  const { search: _search, ...advancedFilters } = filters;
  const advancedCount = Object.keys(advancedFilters).length;
  const [expanded, setExpanded] = useState(advancedCount > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Buscar"
            placeholder="Descrição, valor ou notas"
            value={filters.search ?? ''}
            onChange={(e) => onChange({ search: orUndef(e.target.value) })}
          />
        </div>
        <Button
          type="button"
          variant={advancedCount > 0 ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros{advancedCount > 0 ? ` (${advancedCount})` : ''}
        </Button>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Valor contém"
              placeholder="Ex.: 100"
              value={filters.amount ?? ''}
              onChange={(e) => onChange({ amount: orUndef(e.target.value) })}
            />
            <Select
              label="Recorrência"
              placeholder="Todas"
              options={RECURRENCE_OPTIONS}
              value={filters.recurrence ?? ''}
              onChange={(e) => onChange({ recurrence: orUndef(e.target.value) as never })}
            />
            <Select
              label="Tipo"
              placeholder="Todos"
              options={TYPE_OPTIONS}
              value={filters.type ?? ''}
              onChange={(e) => onChange({ type: orUndef(e.target.value) as never })}
            />
            <EntitySelect
              label="Categoria"
              placeholder="Todas"
              options={categoryOptions}
              value={filters.categoryId ?? ''}
              onChange={(v) => onChange({ categoryId: orUndef(v) })}
            />
            <EntitySelect
              label="Conta"
              placeholder="Todas"
              options={accountOptions}
              value={filters.accountId ?? ''}
              onChange={(v) => onChange({ accountId: orUndef(v) })}
            />
            <EntitySelect
              label="Cartão"
              placeholder="Todos"
              options={cardOptions}
              value={filters.creditCardId ?? ''}
              onChange={(v) => onChange({ creditCardId: orUndef(v) })}
            />
            <Switch
              label="Agrupar despesas de cartão de crédito"
              checked={groupCreditCardExpenses}
              onChange={(e) => onGroupCreditCardExpensesChange(e.target.checked)}
            />
            <Switch
              label="Pendentes de meses anteriores"
              checked={showOverdue}
              onChange={(e) => onShowOverdueChange(e.target.checked)}
            />
            {advancedCount > 0 ? (
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Limpar filtros
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
