'use client';

import { useState } from 'react';
import type { TransactionDto } from '@finance/contracts';
import { Button, Modal } from '@finance/ui';

export interface ConfirmDeleteModalProps {
  open: boolean;
  transaction?: TransactionDto;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  submitting?: boolean;
}

/** Confirmation before permanently deleting a single (non-grouped) transaction. */
export function ConfirmDeleteModal({
  open,
  transaction,
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
      title="Excluir transação"
      description={
        transaction
          ? `Tem certeza que deseja excluir "${transaction.description}"? Esta ação não pode ser desfeita.`
          : 'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.'
      }
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
