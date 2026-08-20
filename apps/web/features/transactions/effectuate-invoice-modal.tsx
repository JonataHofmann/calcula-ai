'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, DatePicker, Modal } from '@finance/ui';
import { dateToIso, isoToDate, todayIso } from '../../util/date';
import { money } from '../../util/money';
import type { InvoiceGroup } from './transactions-table';

const formSchema = z.object({
  date: z.string().datetime('Informe a data'),
});

interface FormValues {
  date: string;
}

export interface EffectuateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string) => Promise<void> | void;
  invoice?: InvoiceGroup;
  submitting?: boolean;
}

export function EffectuateInvoiceModal({
  open,
  onClose,
  onConfirm,
  invoice,
  submitting,
}: EffectuateInvoiceModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: { date: todayIso() },
  });

  const [rootError, setRootError] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await onConfirm(values.date);
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao efetivar fatura');
    }
  });

  const pendingCount = invoice?.transactions.filter((t) => t.status === 'pending').length ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Efetivar fatura"
      description={
        invoice
          ? `${invoice.cardName} — ${pendingCount} transações — total ${money(invoice.total)}`
          : 'Confirme a data de pagamento da fatura.'
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-3">
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

        {rootError ? <p className="text-danger text-sm">{rootError}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
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
