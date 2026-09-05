'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type {
  CreateProjectionEstimateInput,
  ProjectionEstimate,
} from '@finance/contracts';
import { Button, CurrencyInput, Input, Modal, Select, type SelectOption } from '@finance/ui';

const formSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição').max(120),
  amount: z.string().refine((v) => Number(v) > 0, 'Valor deve ser maior que zero'),
  type: z.enum(['expense', 'income']),
});

type FormValues = z.infer<typeof formSchema>;

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
];

export interface ProjectionEstimateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateProjectionEstimateInput) => Promise<void> | void;
  /** Present when editing an existing estimate. */
  initial?: ProjectionEstimate;
  submitting?: boolean;
}

/**
 * Create/edit a projection-only estimate (recurring monthly average shown in the forecast).
 * No account/card/category — só descrição, valor e tipo.
 */
export function ProjectionEstimateModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
}: ProjectionEstimateModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      description: initial?.description ?? '',
      amount: initial?.amount ?? '',
      type: initial?.type ?? 'expense',
    },
  });

  const [rootError, setRootError] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao salvar a estimativa');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar estimativa' : 'Nova estimativa'}
      description="Aparece só na previsão (média mensal). Não vira transação."
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Input
                label="Descrição"
                placeholder="Ex.: Mercado (média)"
                error={errors.description?.message}
                value={field.value}
                onChange={field.onChange}
                maxLength={120}
              />
            )}
          />
        </div>

        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <CurrencyInput
              label="Valor mensal"
              error={errors.amount?.message}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select
              label="Tipo"
              options={TYPE_OPTIONS}
              error={errors.type?.message}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            />
          )}
        />

        {rootError ? <p className="text-danger text-sm sm:col-span-2">{rootError}</p> : null}

        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {initial ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
