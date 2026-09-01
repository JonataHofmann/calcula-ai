'use client';

import { useMemo, useState } from 'react';
import type { ForecastQuery, ForecastResponse } from '@finance/contracts';
import { Card, Skeleton, Switch } from '@finance/ui';
import { useAppSelector } from '../../hooks/use-store';
import { centsToMoney, toCents } from '../../util/money';
import { ForecastHorizonFilter } from './forecast-horizon-filter';
import { ForecastReport } from './forecast-report';
import { useForecast } from './use-forecast';

/** 'YYYY-MM' for the period store's anchor month (0-11 → 1-12). */
function fromMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Drops fixed-expense rows and recomputes the month totals so the Total line matches what's shown. */
function withoutFixed(forecast: ForecastResponse): ForecastResponse {
  const rows = forecast.rows.filter((row) => row.recurrence !== 'fixed');
  const totals = forecast.months.map((month, i) => {
    const cents = rows.reduce((sum, row) => {
      const amount = row.cells[i]?.amount;
      return amount != null ? sum + toCents(amount) : sum;
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

  const query: ForecastQuery = useMemo(
    () => ({ from: fromMonth(period.year, period.month), months }),
    [period.year, period.month, months],
  );

  const { data: forecast, isLoading } = useForecast(query);

  const visibleForecast = useMemo(
    () => (forecast && !showFixed ? withoutFixed(forecast) : forecast),
    [forecast, showFixed],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Previsão de Despesas</h1>
          <p className="text-text-muted text-sm">Parcelamentos e despesas fixas nos próximos meses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            label="Mostrar despesas fixas"
            checked={showFixed}
            onChange={(e) => setShowFixed(e.target.checked)}
          />
          <Switch
            label="Agrupar por cartão"
            checked={groupByCard}
            onChange={(e) => setGroupByCard(e.target.checked)}
          />
          <ForecastHorizonFilter value={months} onValueChange={setMonths} />
        </div>
      </div>

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
    </div>
  );
}
