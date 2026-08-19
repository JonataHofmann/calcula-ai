'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  findCardBrand,
  type CategoryNodeDto,
  type CategoryTreeDto,
  type ColorToken,
  type CreateTransactionInput,
  type IconKey,
  type TransactionDto,
} from '@finance/contracts';
import { CalendarRange, MessageSquare, Tags } from 'lucide-react';
import {
  Button,
  CurrencyInput,
  DatePicker,
  EntitySelect,
  Input,
  Modal,
  Select,
  type EntityOption,
  type SelectOption,
} from '@finance/ui';
import { dateToIso, isoToDate, todayIso } from '../../util/date';

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

export interface AccountLike {
  id: string;
  name: string;
  icon?: IconKey;
  color?: ColorToken;
}

export interface CardLike {
  id: string;
  name: string;
  brandId?: string;
  lastDigits?: string;
}

export interface TransactionOptionSource {
  categories?: CategoryTreeDto;
  accounts: AccountLike[];
  cards: CardLike[];
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

/** Flattens a category tree branch into indented options carrying icon + color. */
function flatten(nodes: CategoryNodeDto[], depth = 0): EntityOption[] {
  const out: EntityOption[] = [];
  for (const node of nodes) {
    out.push({ value: node.id, label: node.name, icon: node.icon, color: node.color, depth });
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

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarRange;
  children: string;
}) {
  return (
    <h3 className="text-text-muted mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </h3>
  );
}

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

  const accountOptions: EntityOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    icon: a.icon ?? 'wallet',
    color: a.color,
  }));
  const cardOptions: EntityOption[] = cards.map((c) => {
    const brand = c.brandId ? findCardBrand(c.brandId) : undefined;
    return {
      value: c.id,
      label: c.name,
      icon: 'credit-card',
      colorHex: brand?.color,
      hint: c.lastDigits ? `•••• ${c.lastDigits}` : undefined,
    };
  });

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
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="transaction-form" loading={submitting}>
            {initial ? 'Salvar' : 'Criar transação'}
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={submit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                label="Tipo"
                options={TYPE_OPTIONS}
                {...field}
                error={errors.type?.message}
              />
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

          <div className="col-span-2">
            <Input
              label="Descrição"
              placeholder="Ex.: Aluguel"
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
        </div>

        <section className="border-border border-t pt-5">
          <SectionHeading icon={CalendarRange}>Valores e prazo</SectionHeading>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className={recurrence === 'single' ? 'sm:col-span-2' : undefined}>
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <DatePicker
                    label="Vencimento"
                    error={errors.dueDate?.message}
                    value={isoToDate(field.value)}
                    onChange={(v) => field.onChange(dateToIso(v))}
                  />
                )}
              />
            </div>
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
                  <DatePicker
                    label="Término (opcional)"
                    error={errors.endDate?.message}
                    value={isoToDate(field.value)}
                    onChange={(v) => field.onChange(dateToIso(v))}
                  />
                )}
              />
            ) : null}

            {recurrence === 'installment' ? (
              <div className="bg-surface-2 rounded-card grid grid-cols-1 gap-x-4 gap-y-1 p-3 sm:col-span-2 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <CurrencyInput
                      label="Valor por parcela"
                      error={errors.amount?.message}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="totalAmount"
                  render={({ field }) => (
                    <CurrencyInput
                      label="Valor total"
                      error={errors.totalAmount?.message}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <p className="text-text-muted text-xs sm:col-span-2">
                  Informe o valor por parcela ou o valor total — o outro é calculado.
                </p>
              </div>
            ) : (
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
            )}
          </div>
        </section>

        <section className="border-border border-t pt-5">
          <SectionHeading icon={Tags}>Classificação e origem</SectionHeading>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className={recurrence === 'installment' ? 'sm:col-span-2' : undefined}>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <EntitySelect
                    label="Categoria"
                    placeholder="Selecione"
                    options={categoryOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.categoryId?.message}
                  />
                )}
              />
            </div>

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
                  <EntitySelect
                    label="Conta"
                    placeholder="Selecione"
                    options={accountOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={originError}
                  />
                )}
              />
            ) : (
              <Controller
                control={control}
                name="creditCardId"
                render={({ field }) => (
                  <EntitySelect
                    label="Cartão de crédito"
                    placeholder="Selecione"
                    options={cardOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={originError}
                  />
                )}
              />
            )}
          </div>
        </section>

        <section className="border-border border-t pt-5">
          <SectionHeading icon={MessageSquare}>Observações</SectionHeading>
          <Input
            label="Observações (opcional)"
            error={errors.notes?.message}
            {...register('notes')}
          />
        </section>

        {rootError ? <p className="text-danger text-sm">{rootError}</p> : null}
      </form>
    </Modal>
  );
}
