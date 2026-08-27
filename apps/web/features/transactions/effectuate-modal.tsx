'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { EffectuateInput, TransactionDto } from '@finance/contracts';
import { Button, CurrencyInput, DatePicker, Modal } from '@finance/ui';
import { dateToIso, isoToDate, todayIso } from '../../util/date';

/** Form-level schema: a date (defaults to today) and an effective amount (defaults to the due amount). */
const formSchema = z.object({
  date: z.string().datetime('Informe a data'),
  amount: z.string().refine((v) => Number(v) > 0, 'Valor deve ser maior que zero'),
});

interface FormValues {
  date: string;
  amount: string;
}

export interface EffectuateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (input: EffectuateInput) => Promise<void> | void;
  transaction?: TransactionDto;
  submitting?: boolean;
}

export function EffectuateModal({
  open,
  onClose,
  onConfirm,
  transaction,
  submitting,
}: EffectuateModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: { date: todayIso(), amount: transaction?.amount ?? '' },
  });

  const [rootError, setRootError] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await onConfirm({ date: values.date, amount: values.amount });
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao efetivar');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Efetivar transação"
      description={transaction ? transaction.description : 'Confirme a data e o valor pagos.'}
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              label="Data"
              error={errors.date?.message}
              value={isoToDate(field.value)}
              onChange={(v) => field.onChange(dateToIso(v))}
            />
          )}
        />

        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <CurrencyInput
              label="Valor"
              error={errors.amount?.message}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        {rootError ? <p className="text-danger text-sm sm:col-span-2">{rootError}</p> : null}

        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
