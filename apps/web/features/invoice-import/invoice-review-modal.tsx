'use client';

import { useMemo, useState } from 'react';
import type {
  CategoryNodeDto,
  CategoryTreeDto,
  InvoiceExtractionResult,
  InvoiceReviewLine,
  ReferenceMonth,
} from '@finance/contracts';
import {
  Button,
  Checkbox,
  EntitySelect,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatBRL,
  type EntityOption,
} from '@finance/ui';
import { AlertTriangle, Trash2, Undo2 } from 'lucide-react';

export interface InvoiceReviewValues {
  referenceMonth: ReferenceMonth;
  lines: InvoiceReviewLine[];
}

export interface InvoiceReviewModalProps {
  open: boolean;
  onClose: () => void;
  extraction: InvoiceExtractionResult;
  categories?: CategoryTreeDto;
  onConfirm: (values: InvoiceReviewValues) => Promise<void> | void;
  submitting?: boolean;
  error?: string;
}

/** Per-line editable review state. */
interface LineState {
  categoryId: string;
  discarded: boolean;
  description: string;
  fixed: boolean;
}

/** Flattens the expense branch into indented options carrying icon + color. */
function flatten(nodes: CategoryNodeDto[], depth = 0): EntityOption[] {
  const out: EntityOption[] = [];
  for (const node of nodes) {
    out.push({
      value: node.id,
      label: node.name,
      icon: node.icon,
      color: node.color,
      depth,
    });
    if (node.children.length > 0) out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

function installmentLabel(n: number | null, m: number | null): string {
  return n && m ? `${n}/${m}` : '';
}

/** A credit line (estorno/pagamento/crédito) arrives negative — it is a receita, not despesa. */
function isIncomeLine(amount: string): boolean {
  return Number(amount) < 0;
}

/**
 * Review step (FR-003a/FR-011): the user sets a category per line, may discard lines,
 * and can adjust the reference month before committing. Category defaults to the
 * history suggestion. Uncertain lines are flagged for attention.
 */
export function InvoiceReviewModal({
  open,
  onClose,
  extraction,
  categories,
  onConfirm,
  submitting,
  error,
}: InvoiceReviewModalProps) {
  const [referenceMonth, setReferenceMonth] = useState<string>(
    extraction.referenceMonth,
  );
  const [lineState, setLineState] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      extraction.lines.map((l) => [
        l.lineId,
        {
          categoryId: l.suggestedCategoryId ?? '',
          discarded: false,
          description: l.description,
          fixed: false,
        },
      ]),
    ),
  );
  const [localError, setLocalError] = useState<string>();

  const expenseOptions = useMemo(
    () => (categories ? flatten(categories.expense) : []),
    [categories],
  );
  const incomeOptions = useMemo(
    () => (categories ? flatten(categories.income) : []),
    [categories],
  );

  function setCategory(lineId: string, categoryId: string) {
    setLineState((s) => ({ ...s, [lineId]: { ...s[lineId]!, categoryId } }));
  }

  function setDescription(lineId: string, description: string) {
    setLineState((s) => ({ ...s, [lineId]: { ...s[lineId]!, description } }));
  }

  function toggleDiscard(lineId: string) {
    setLineState((s) => ({
      ...s,
      [lineId]: { ...s[lineId]!, discarded: !s[lineId]!.discarded },
    }));
  }

  function toggleFixed(lineId: string) {
    setLineState((s) => ({
      ...s,
      [lineId]: { ...s[lineId]!, fixed: !s[lineId]!.fixed },
    }));
  }

  const keptCount = extraction.lines.filter(
    (l) => !lineState[l.lineId]?.discarded,
  ).length;

  async function confirm() {
    const kept = extraction.lines.filter((l) => !lineState[l.lineId]?.discarded);
    if (kept.length === 0) {
      return setLocalError('Mantenha ao menos um lançamento para importar');
    }
    const missing = kept.filter((l) => !lineState[l.lineId]?.categoryId);
    if (missing.length > 0) {
      return setLocalError(
        `Informe a categoria de ${missing.length} lançamento(s)`,
      );
    }
    const blank = kept.filter((l) => !lineState[l.lineId]?.description.trim());
    if (blank.length > 0) {
      return setLocalError(
        `Informe a descrição de ${blank.length} lançamento(s)`,
      );
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
      return setLocalError('Mês de referência deve ser YYYY-MM');
    }
    setLocalError(undefined);

    const lines: InvoiceReviewLine[] = extraction.lines.map((l) => {
      const state = lineState[l.lineId]!;
      const description = state.description.trim();
      return {
        ...l,
        description,
        // Keep the raw extracted text when the user renamed the line.
        originalDescription: description !== l.description ? l.description : undefined,
        categoryId: state.categoryId,
        discarded: state.discarded,
        fixed: state.fixed,
      };
    });
    await onConfirm({ referenceMonth: referenceMonth as ReferenceMonth, lines });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revisar lançamentos"
      description="Confira as categorias e descarte o que não quiser importar."
      className="max-w-6xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="w-40">
            <Input
              label="Mês de referência"
              placeholder="YYYY-MM"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
            />
          </div>
          <div className="text-right">
            {extraction.total !== null && (
              <p className="text-text text-sm font-medium">
                Total da fatura: {formatBRL(extraction.total)}
              </p>
            )}
            <p className="text-text-muted text-sm">
              {keptCount} de {extraction.lines.length} lançamento(s)
            </p>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Fixa</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraction.lines.map((line) => {
                const state = lineState[line.lineId]!;
                const income = isIncomeLine(line.amount);
                return (
                  <TableRow
                    key={line.lineId}
                    className={state.discarded ? 'opacity-50' : undefined}
                  >
                    <TableCell>
                      {new Date(line.date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="min-w-[12rem]">
                      <span className="flex items-center gap-1.5">
                        {line.uncertain && (
                          <AlertTriangle
                            className="text-warning h-4 w-4 shrink-0"
                            aria-label="Extração incerta — confira"
                          />
                        )}
                        <Input
                          value={state.description}
                          onChange={(e) =>
                            setDescription(line.lineId, e.target.value)
                          }
                          disabled={state.discarded}
                          maxLength={120}
                          aria-label="Descrição"
                        />
                      </span>
                    </TableCell>
                    <TableCell>
                      {installmentLabel(
                        line.installmentNumber,
                        line.installmentCount,
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          income
                            ? 'text-success font-medium'
                            : 'text-text'
                        }
                      >
                        {income ? '+' : ''}
                        {formatBRL(String(Math.abs(Number(line.amount))))}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${income ? 'text-success' : 'text-text-muted'}`}
                      >
                        {income ? 'Receita' : 'Despesa'}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[11rem]">
                      <EntitySelect
                        value={state.categoryId}
                        onChange={(v) => setCategory(line.lineId, v)}
                        options={income ? incomeOptions : expenseOptions}
                        placeholder={income ? 'Categoria de receita' : 'Categoria'}
                        disabled={state.discarded}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={state.fixed}
                        onChange={() => toggleFixed(line.lineId)}
                        disabled={state.discarded || income}
                        aria-label="Marcar como despesa fixa"
                        title="Despesa fixa (recorrente, sem parcelas)"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleDiscard(line.lineId)}
                        aria-label={
                          state.discarded ? 'Restaurar linha' : 'Descartar linha'
                        }
                      >
                        {state.discarded ? (
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {(localError ?? error) && (
          <p className="text-sm text-red-600">{localError ?? error}</p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={submitting}>
            {submitting ? 'Importando…' : 'Continuar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
