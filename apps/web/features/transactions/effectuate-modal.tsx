'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { EffectuateInput, TransactionDto } from '@finance/contracts';
import { Button, Input, Modal } from '@finance/ui';

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

/** 'YYYY-MM-DD' → ISO instant at UTC midnight; '' → ''. */
function dateToIso(date: string): string {
  return date ? `${date}T00:00:00.000Z` : '';
}

/** ISO instant → 'YYYY-MM-DD' for a native date input. */
function isoToDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function todayIso(): string {
  return dateToIso(new Date().toISOString().slice(0, 10));
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
    register,
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
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <Input
              type="date"
              label="Data"
              error={errors.date?.message}
              value={isoToDate(field.value)}
              onChange={(e) => field.onChange(dateToIso(e.target.value))}
            />
          )}
        />

        <Input
          label="Valor"
          placeholder="0,00"
          error={errors.amount?.message}
          {...register('amount')}
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
