'use client';

import { useState } from 'react';
import type { TransactionDto } from '@finance/contracts';
import { Button, Modal } from '@finance/ui';

export interface ConfirmDeleteModalProps {
  open: boolean;
  transaction?: TransactionDto;
  /** When set, confirms a bulk deletion of this many transactions instead of a single one. */
  count?: number;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  submitting?: boolean;
}

function describe(transaction?: TransactionDto, count?: number): string {
  if (count !== undefined) {
    return `Tem certeza que deseja excluir ${count} ${
      count === 1 ? 'transação' : 'transações'
    }? Esta ação não pode ser desfeita.`;
  }
  if (transaction) {
    return `Tem certeza que deseja excluir "${transaction.description}"? Esta ação não pode ser desfeita.`;
  }
  return 'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.';
}

/** Confirmation before permanently deleting a single (non-grouped) transaction or a bulk selection. */
export function ConfirmDeleteModal({
  open,
  transaction,
  count,
  onClose,
  onConfirm,
  submitting,
}: ConfirmDeleteModalProps) {
  const [rootError, setRootError] = useState<string | null>(null);

  const confirm = async () => {
    setRootError(null);
    try {
      await onConfirm();
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao excluir');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={count !== undefined ? 'Excluir transações' : 'Excluir transação'}
      description={describe(transaction, count)}
    >
      <div className="flex flex-col gap-2">
        {rootError ? <p className="text-danger text-sm">{rootError}</p> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" loading={submitting} onClick={confirm}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
