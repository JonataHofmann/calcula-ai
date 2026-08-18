'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  type AccountDto,
  createAccountInput,
  type CreateAccountInput,
} from '@finance/contracts';
import {
  BankSelect,
  Button,
  ColorPicker,
  IconPicker,
  Input,
  Modal,
} from '@finance/ui';

export interface AccountFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateAccountInput) => Promise<void> | void;
  initial?: AccountDto;
  submitting?: boolean;
}

const EMPTY: CreateAccountInput = {
  name: '',
  bankId: 'nubank',
  icon: 'wallet',
  color: 'primary',
};

export function AccountFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
}: AccountFormModalProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountInput),
    values: initial
      ? {
          name: initial.name,
          bankId: initial.bankId,
          icon: initial.icon,
          color: initial.color,
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
      title={initial ? 'Editar conta' : 'Nova conta'}
      description="Escolha o banco, um ícone e uma cor para identificar a conta."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          placeholder="Ex.: Conta corrente"
          error={errors.name?.message}
          {...register('name')}
        />

        <Controller
          control={control}
          name="bankId"
          render={({ field }) => (
            <BankSelect
              label="Banco"
              value={field.value}
              onChange={field.onChange}
              error={errors.bankId?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <IconPicker
              label="Ícone"
              value={field.value}
              onChange={field.onChange}
              error={errors.icon?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              label="Cor"
              value={field.value}
              onChange={field.onChange}
              error={errors.color?.message}
            />
          )}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {initial ? 'Salvar' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
