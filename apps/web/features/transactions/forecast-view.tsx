'use client';

import { useMemo, useState } from 'react';
import type { ForecastQuery } from '@finance/contracts';
import { Card, Skeleton, Switch } from '@finance/ui';
import { useAppSelector } from '../../hooks/use-store';
import { ForecastHorizonFilter } from './forecast-horizon-filter';
import { ForecastReport } from './forecast-report';
import { useForecast } from './use-forecast';

/** 'YYYY-MM' for the period store's anchor month (0-11 → 1-12). */
function fromMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function ForecastView() {
  const period = useAppSelector((s) => s.period);
  const [months, setMonths] = useState<ForecastQuery['months']>(6);
  const [groupByCard, setGroupByCard] = useState(false);

  const query: ForecastQuery = useMemo(
    () => ({ from: fromMonth(period.year, period.month), months }),
    [period.year, period.month, months],
  );

  const { data: forecast, isLoading } = useForecast(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Previsão de Despesas</h1>
          <p className="text-text-muted text-sm">Parcelamentos e despesas fixas nos próximos meses.</p>
        </div>
        <div className="flex items-center gap-4">
          <Switch
            label="Agrupar por cartão"
            checked={groupByCard}
            onChange={(e) => setGroupByCard(e.target.checked)}
          />
          <ForecastHorizonFilter value={months} onValueChange={setMonths} />
        </div>
      </div>

      {isLoading || !forecast ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-card" />
          ))}
        </div>
      ) : (
        <Card className="p-2">
          <ForecastReport forecast={forecast} groupByCard={groupByCard} />
        </Card>
      )}
    </div>
  );
}
