'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  CARD_BRANDS,
  createCreditCardInput,
  type CreateCreditCardInput,
  type CreditCardDto,
} from '@finance/contracts';
import { Button, Input, Modal, Select, type SelectOption } from '@finance/ui';

export interface CardFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateCreditCardInput) => Promise<void> | void;
  initial?: CreditCardDto;
  submitting?: boolean;
}

const BRAND_OPTIONS: SelectOption[] = CARD_BRANDS.map((b) => ({
  value: b.id,
  label: b.name,
}));

const EMPTY: CreateCreditCardInput = {
  name: '',
  lastDigits: '',
  dueDay: 10,
  closingDay: 3,
  limit: '0.00',
  brandId: 'visa',
};

export function CardFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
}: CardFormModalProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCreditCardInput>({
    resolver: zodResolver(createCreditCardInput),
    values: initial
      ? {
          name: initial.name,
          lastDigits: initial.lastDigits,
          dueDay: initial.dueDay,
          closingDay: initial.closingDay,
          limit: initial.limit,
          brandId: initial.brandId,
        }
      : EMPTY,
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar cartão' : 'Novo cartão'}
      description="Guardamos apenas os 4 últimos dígitos — nunca o número completo."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          placeholder="Ex.: Nubank Roxinho"
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="4 últimos dígitos"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            error={errors.lastDigits?.message}
            {...register('lastDigits')}
          />

          <Controller
            control={control}
            name="brandId"
            render={({ field }) => (
              <Select
                label="Bandeira"
                options={BRAND_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.brandId?.message}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Dia de fechamento"
            type="number"
            min={1}
            max={31}
            error={errors.closingDay?.message}
            {...register('closingDay', { valueAsNumber: true })}
          />
          <Input
            label="Dia de vencimento"
            type="number"
            min={1}
            max={31}
            error={errors.dueDay?.message}
            {...register('dueDay', { valueAsNumber: true })}
          />
        </div>

        <Input
          label="Limite"
          inputMode="decimal"
          placeholder="0.00"
          helpText="Valor em reais, com duas casas decimais (ex.: 5000.00)."
          error={errors.limit?.message}
          {...register('limit')}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {initial ? 'Salvar' : 'Criar cartão'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
