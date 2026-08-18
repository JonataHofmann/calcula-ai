'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  type CategoryNodeDto,
  type CategoryTreeDto,
  type CreateTransactionInput,
  type TransactionDto,
} from '@finance/contracts';
import { Button, Input, Modal, Select, type SelectOption } from '@finance/ui';

/** Form-level schema: mirrors the visible fields, then transformed to CreateTransactionInput on submit. */
const formSchema = z
  .object({
    type: z.enum(['expense', 'income']),
    recurrence: z.enum(['single', 'fixed', 'installment']),
    description: z.string().trim().min(1, 'Descrição é obrigatória').max(120),
    dueDate: z.string().datetime('Informe o vencimento'),
    amount: z.string().optional().default(''),
    totalAmount: z.string().optional().default(''),
    installmentCount: z.string().optional().default(''),
    endDate: z.string().optional().default(''),
    categoryId: z.string().uuid('Selecione a categoria'),
    originKind: z.enum(['account', 'card']),
    accountId: z.string().optional().default(''),
    creditCardId: z.string().optional().default(''),
    notes: z.string().optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.recurrence === 'installment') {
      const hasAmount = v.amount.trim() !== '';
      const hasTotal = v.totalAmount.trim() !== '';
      if (hasAmount === hasTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['totalAmount'],
          message: 'Informe valor por parcela OU valor total',
        });
      }
      const count = Number(v.installmentCount);
      if (!Number.isInteger(count) || count < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installmentCount'],
          message: 'Mínimo de 1 parcela',
        });
      }
    } else if (v.amount.trim() === '' || !(Number(v.amount) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Valor deve ser maior que zero',
      });
    }

    if (v.type === 'expense') {
      if (v.originKind === 'account' && !v.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accountId'],
          message: 'Selecione a conta',
        });
      }
      if (v.originKind === 'card' && !v.creditCardId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['creditCardId'],
          message: 'Selecione o cartão',
        });
      }
    } else if (!v.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountId'],
        message: 'Receita exige uma conta',
      });
    }

    if (
      v.recurrence === 'fixed' &&
      v.endDate &&
      new Date(v.endDate).getTime() < new Date(v.dueDate).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Término deve ser posterior ao vencimento',
      });
    }
  });

export interface TransactionOptionSource {
  categories?: CategoryTreeDto;
  accounts: { id: string; name: string }[];
  cards: { id: string; name: string }[];
}

export interface TransactionFormModalProps extends TransactionOptionSource {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateTransactionInput) => Promise<void> | void;
  initial?: TransactionDto;
  submitting?: boolean;
}

/** Local form shape — a superset of every recurrence variant; trimmed on submit. */
interface FormValues {
  type: 'expense' | 'income';
  recurrence: 'single' | 'fixed' | 'installment';
  description: string;
  dueDate: string;
  amount: string;
  totalAmount: string;
  installmentCount: string;
  endDate: string;
  categoryId: string;
  originKind: 'account' | 'card';
  accountId: string;
  creditCardId: string;
  notes: string;
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

/** Flattens a category tree branch into indented select options. */
function flatten(nodes: CategoryNodeDto[], depth = 0): SelectOption[] {
  const out: SelectOption[] = [];
  for (const node of nodes) {
    out.push({ value: node.id, label: `${'— '.repeat(depth)}${node.name}` });
    if (node.children.length > 0) out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

function defaults(initial?: TransactionDto): FormValues {
  if (!initial) {
    return {
      type: 'expense',
      recurrence: 'single',
      description: '',
      dueDate: todayIso(),
      amount: '',
      totalAmount: '',
      installmentCount: '',
      endDate: '',
      categoryId: '',
      originKind: 'account',
      accountId: '',
      creditCardId: '',
      notes: '',
    };
  }
  return {
    type: initial.type,
    recurrence: initial.recurrence,
    description: initial.description,
    dueDate: initial.dueDate,
    amount: initial.amount,
    totalAmount: '',
    installmentCount: initial.installmentCount?.toString() ?? '',
    endDate: initial.endDate ?? '',
    categoryId: initial.categoryId,
    originKind: initial.creditCardId ? 'card' : 'account',
    accountId: initial.accountId ?? '',
    creditCardId: initial.creditCardId ?? '',
    notes: initial.notes ?? '',
  };
}

/** Builds the CreateTransactionInput from form values, dropping fields foreign to the variant. */
function toInput(v: FormValues): CreateTransactionInput {
  const base = {
    type: v.type,
    description: v.description,
    dueDate: v.dueDate,
    categoryId: v.categoryId,
    notes: v.notes.trim() === '' ? undefined : v.notes,
    accountId: v.type === 'income' || v.originKind === 'account' ? v.accountId || undefined : undefined,
    creditCardId:
      v.type === 'expense' && v.originKind === 'card' ? v.creditCardId || undefined : undefined,
  };
  if (v.recurrence === 'installment') {
    const count = Number(v.installmentCount);
    return {
      ...base,
      recurrence: 'installment',
      installmentCount: Number.isFinite(count) ? count : 0,
      ...(v.totalAmount ? { totalAmount: v.totalAmount } : { amount: v.amount || undefined }),
    } as CreateTransactionInput;
  }
  if (v.recurrence === 'fixed') {
    return {
      ...base,
      recurrence: 'fixed',
      amount: v.amount,
      endDate: v.endDate ? v.endDate : null,
    } as CreateTransactionInput;
  }
  return { ...base, recurrence: 'single', amount: v.amount } as CreateTransactionInput;
}

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
];

const RECURRENCE_OPTIONS: SelectOption[] = [
  { value: 'single', label: 'Avulsa' },
  { value: 'fixed', label: 'Fixa' },
  { value: 'installment', label: 'Parcelada' },
];

const ORIGIN_OPTIONS: SelectOption[] = [
  { value: 'account', label: 'Conta' },
  { value: 'card', label: 'Cartão de crédito' },
];

export function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  categories,
  accounts,
  cards,
  initial,
  submitting,
}: TransactionFormModalProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: defaults(initial),
  });

  const type = watch('type');
  const recurrence = watch('recurrence');
  const originKind = watch('originKind');
  const [rootError, setRootError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    return flatten(type === 'income' ? categories.income : categories.expense);
  }, [categories, type]);

  const accountOptions: SelectOption[] = accounts.map((a) => ({ value: a.id, label: a.name }));
  const cardOptions: SelectOption[] = cards.map((c) => ({ value: c.id, label: c.name }));

  const submit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await onSubmit(toInput(values));
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  });

  const originError = errors.accountId?.message ?? errors.creditCardId?.message;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar transação' : 'Nova transação'}
      description="Preencha os dados da transação."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select label="Tipo" options={TYPE_OPTIONS} {...field} error={errors.type?.message} />
            )}
          />
          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <Select
                label="Recorrência"
                options={RECURRENCE_OPTIONS}
                {...field}
                error={errors.recurrence?.message}
              />
            )}
          />
        </div>

        <Input
          label="Descrição"
          placeholder="Ex.: Aluguel"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <Input
                type="date"
                label="Vencimento"
                error={errors.dueDate?.message}
                value={isoToDate(field.value)}
                onChange={(e) => field.onChange(dateToIso(e.target.value))}
              />
            )}
          />
          {recurrence === 'installment' ? (
            <Input
              type="number"
              min={1}
              label="Parcelas"
              error={errors.installmentCount?.message}
              {...register('installmentCount')}
            />
          ) : recurrence === 'fixed' ? (
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <Input
                  type="date"
                  label="Término (opcional)"
                  error={errors.endDate?.message}
                  value={isoToDate(field.value)}
                  onChange={(e) => field.onChange(dateToIso(e.target.value))}
                />
              )}
            />
          ) : null}
        </div>

        {recurrence === 'installment' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor por parcela"
              placeholder="0,00"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <Input
              label="Valor total"
              placeholder="0,00"
              error={errors.totalAmount?.message}
              {...register('totalAmount')}
            />
          </div>
        ) : (
          <Input
            label="Valor"
            placeholder="0,00"
            error={errors.amount?.message}
            {...register('amount')}
          />
        )}

        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select
              label="Categoria"
              placeholder="Selecione"
              options={categoryOptions}
              {...field}
              error={errors.categoryId?.message}
            />
          )}
        />

        {type === 'expense' ? (
          <Controller
            control={control}
            name="originKind"
            render={({ field }) => (
              <Select label="Origem" options={ORIGIN_OPTIONS} {...field} />
            )}
          />
        ) : null}

        {type === 'income' || originKind === 'account' ? (
          <Controller
            control={control}
            name="accountId"
            render={({ field }) => (
              <Select
                label="Conta"
                placeholder="Selecione"
                options={accountOptions}
                {...field}
                error={originError}
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="creditCardId"
            render={({ field }) => (
              <Select
                label="Cartão de crédito"
                placeholder="Selecione"
                options={cardOptions}
                {...field}
                error={originError}
              />
            )}
          />
        )}

        <Input label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />

        {rootError ? <p className="text-danger text-sm">{rootError}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {initial ? 'Salvar' : 'Criar transação'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
