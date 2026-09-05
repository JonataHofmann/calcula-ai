'use client';

import { useMemo, useState } from 'react';
import type {
  CreateProjectionEstimateInput,
  ForecastQuery,
  ForecastResponse,
  ProjectionEstimate,
} from '@finance/contracts';
import { Button, Card, Skeleton, Switch } from '@finance/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAppSelector } from '../../hooks/use-store';
import { centsToMoney, money, toCents } from '../../util/money';
import { ForecastHorizonFilter } from './forecast-horizon-filter';
import { ForecastReport } from './forecast-report';
import { ProjectionEstimateModal } from './projection-estimate-modal';
import { useForecast } from './use-forecast';
import {
  useCreateProjectionEstimate,
  useDeleteProjectionEstimate,
  useProjectionEstimates,
  useUpdateProjectionEstimate,
} from './use-projection-estimates';

/** 'YYYY-MM' for the period store's anchor month (0-11 → 1-12). */
function fromMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Drops fixed and/or estimate rows and recomputes the month totals so the Total line matches what's
 * shown. Totals net by type: expenses add, incomes (estimates) subtract.
 */
function applyForecastView(
  forecast: ForecastResponse,
  opts: { showFixed: boolean; showEstimates: boolean },
): ForecastResponse {
  const rows = forecast.rows.filter(
    (row) =>
      (opts.showFixed || row.recurrence !== 'fixed') &&
      (opts.showEstimates || row.recurrence !== 'estimate'),
  );
  const totals = forecast.months.map((month, i) => {
    const cents = rows.reduce((sum, row) => {
      const amount = row.cells[i]?.amount;
      if (amount == null) return sum;
      return row.type === 'income' ? sum - toCents(amount) : sum + toCents(amount);
    }, 0);
    return { month, amount: centsToMoney(cents) };
  });
  return { ...forecast, rows, totals };
}

export function ForecastView() {
  const period = useAppSelector((s) => s.period);
  const [months, setMonths] = useState<ForecastQuery['months']>(6);
  const [groupByCard, setGroupByCard] = useState(false);
  const [showFixed, setShowFixed] = useState(true);
  const [showEstimates, setShowEstimates] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectionEstimate | undefined>(undefined);

  const query: ForecastQuery = useMemo(
    () => ({ from: fromMonth(period.year, period.month), months }),
    [period.year, period.month, months],
  );

  const { data: forecast, isLoading } = useForecast(query);
  const { data: estimates } = useProjectionEstimates();
  const createEstimate = useCreateProjectionEstimate();
  const updateEstimate = useUpdateProjectionEstimate();
  const deleteEstimate = useDeleteProjectionEstimate();

  const visibleForecast = useMemo(
    () => (forecast ? applyForecastView(forecast, { showFixed, showEstimates }) : forecast),
    [forecast, showFixed, showEstimates],
  );

  const openCreate = () => {
    setEditing(undefined);
    setModalOpen(true);
  };
  const openEdit = (estimate: ProjectionEstimate) => {
    setEditing(estimate);
    setModalOpen(true);
  };

  const submitEstimate = async (input: CreateProjectionEstimateInput) => {
    if (editing) {
      await updateEstimate.mutateAsync({ id: editing.id, input });
    } else {
      await createEstimate.mutateAsync(input);
    }
    setModalOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Previsão de Despesas</h1>
          <p className="text-text-muted text-sm">Parcelamentos, despesas fixas e estimativas nos próximos meses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            label="Mostrar despesas fixas"
            checked={showFixed}
            onChange={(e) => setShowFixed(e.target.checked)}
          />
          <Switch
            label="Mostrar estimativas"
            checked={showEstimates}
            onChange={(e) => setShowEstimates(e.target.checked)}
          />
          <Switch
            label="Agrupar por cartão"
            checked={groupByCard}
            onChange={(e) => setGroupByCard(e.target.checked)}
          />
          <ForecastHorizonFilter value={months} onValueChange={setMonths} />
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-text text-sm font-semibold">Estimativas de projeção</p>
            <p className="text-text-muted text-sm">
              Médias mensais que só aparecem aqui (ex.: mercado). Não viram transações.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova estimativa
          </Button>
        </div>
        {estimates && estimates.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {estimates.map((est) => (
              <li key={est.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <span className="text-text text-sm font-medium">{est.description}</span>
                  <span
                    className={`ml-2 text-sm ${est.type === 'income' ? 'text-success' : 'text-text-muted'}`}
                  >
                    {est.type === 'income' ? '+' : ''}
                    {money(est.amount)} /mês
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(est)}
                    aria-label={`Editar ${est.description}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEstimate.mutate(est.id)}
                    aria-label={`Excluir ${est.description}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted text-sm">Nenhuma estimativa cadastrada.</p>
        )}
      </Card>

      {isLoading || !visibleForecast ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-card" />
          ))}
        </div>
      ) : (
        <Card className="p-2">
          <ForecastReport forecast={visibleForecast} groupByCard={groupByCard} />
        </Card>
      )}

      <ProjectionEstimateModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSubmit={submitEstimate}
        initial={editing}
        submitting={createEstimate.isPending || updateEstimate.isPending}
      />
    </div>
  );
}
