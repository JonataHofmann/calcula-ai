'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, DatePicker, Modal } from '@finance/ui';
import { dateToIso, isoToDate, todayIso } from '../../util/date';

const formSchema = z.object({ date: z.string().datetime('Informe a data') });

export interface BulkEffectuateModalProps {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void> | void;
  submitting?: boolean;
}

/** Effectuates a batch of pending transactions on one shared date; each keeps its own amount. */
export function BulkEffectuateModal({
  open,
  count,
  onClose,
  onConfirm,
  submitting,
}: BulkEffectuateModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<{ date: string }>({
    resolver: zodResolver(formSchema),
    values: { date: todayIso() },
  });
  const [rootError, setRootError] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await onConfirm(values.date);
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao efetivar');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Efetivar transações"
      description={`Marcar ${count} ${count === 1 ? 'transação' : 'transações'} como paga${
        count === 1 ? '' : 's'
      } nesta data. Cada uma mantém o próprio valor.`}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              label="Data de efetivação"
              value={isoToDate(field.value)}
              onChange={(d) => field.onChange(d ? dateToIso(d) : '')}
              error={errors.date?.message}
            />
          )}
        />

        {rootError ? <p className="text-danger text-sm">{rootError}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Efetivar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
