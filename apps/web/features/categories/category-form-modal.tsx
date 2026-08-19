'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  type CategoryType,
  type ColorToken,
  createCategoryInput,
  type CreateCategoryInput,
  createSubcategoryInput,
  type IconKey,
} from '@finance/contracts';
import {
  Button,
  COLOR_TOKEN_SOFT_BG,
  COLOR_TOKEN_TEXT,
  ColorPicker,
  getIcon,
  IconPicker,
  Input,
  Modal,
  Select,
} from '@finance/ui';

export type CategoryFormMode = 'create' | 'edit' | 'subcategory';

export interface CategoryFormValues {
  name: string;
  type: CategoryType;
  icon: IconKey;
  color: ColorToken;
}

export interface CategoryFormModalProps {
  open: boolean;
  mode: CategoryFormMode;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => Promise<void> | void;
  /** Prefill (edit) or the parent's type (subcategory) so the child inherits it. */
  initial?: CategoryFormValues;
  /** Name of the parent, shown as context when adding a subcategory. */
  parentName?: string;
  submitting?: boolean;
}

const EMPTY: CategoryFormValues = {
  name: '',
  type: 'expense',
  icon: 'utensils',
  color: 'primary',
};

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
];

export function CategoryFormModal({
  open,
  mode,
  onClose,
  onSubmit,
  initial,
  parentName,
  submitting,
}: CategoryFormModalProps) {
  const withType = mode === 'create';
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(withType ? createCategoryInput : createSubcategoryInput),
    values: initial ?? EMPTY,
  });

  const previewName = watch('name');
  const previewIcon = watch('icon');
  const previewColor = watch('color');
  const PreviewIcon = getIcon(previewIcon);

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      name: values.name,
      // Non-create modes never change the type: keep the inherited/original one.
      type: withType ? values.type : (initial?.type ?? EMPTY.type),
      icon: values.icon,
      color: values.color,
    });
  });

  const title =
    mode === 'create'
      ? 'Nova categoria'
      : mode === 'subcategory'
        ? 'Nova subcategoria'
        : 'Editar categoria';

  const description =
    mode === 'subcategory' && parentName
      ? `Subcategoria de "${parentName}". Herda o tipo da categoria pai.`
      : 'Escolha um nome, um ícone e uma cor para identificar a categoria.';

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="bg-surface-2 rounded-card flex items-center gap-3 p-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${COLOR_TOKEN_SOFT_BG[previewColor]} ${COLOR_TOKEN_TEXT[previewColor]}`}
          >
            <PreviewIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-text truncate text-sm font-medium">
            {previewName || 'Pré-visualização'}
          </span>
        </div>

        <Input
          label="Nome"
          placeholder="Ex.: Alimentação"
          error={errors.name?.message}
          {...register('name')}
        />

        {withType ? (
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                label="Tipo"
                options={TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.type?.message}
              />
            )}
          />
        ) : null}

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
            {mode === 'edit' ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
