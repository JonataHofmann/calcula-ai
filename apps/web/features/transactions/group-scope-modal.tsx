'use client';

import { useState } from 'react';
import type { GroupScope } from '@finance/contracts';
import { Button, Modal } from '@finance/ui';

export interface GroupScopeModalProps {
  open: boolean;
  action: 'edit' | 'delete';
  onClose: () => void;
  onConfirm: (scope: GroupScope) => Promise<void> | void;
  submitting?: boolean;
}

const SCOPES: { scope: GroupScope; label: string }[] = [
  { scope: 'one', label: 'Somente esta ocorrência' },
  { scope: 'future', label: 'Esta e as próximas' },
  { scope: 'all', label: 'Todas as ocorrências' },
];

/**
 * Asks how a change to a grouped (fixed/installment) occurrence should propagate.
 * Each choice fires onConfirm immediately with the picked scope.
 */
export function GroupScopeModal({
  open,
  action,
  onClose,
  onConfirm,
  submitting,
}: GroupScopeModalProps) {
  const [pending, setPending] = useState<GroupScope | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);

  const pick = async (scope: GroupScope) => {
    setRootError(null);
    setPending(scope);
    try {
      await onConfirm(scope);
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Falha ao aplicar');
    } finally {
      setPending(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={action === 'delete' ? 'Excluir recorrência' : 'Editar recorrência'}
      description="Escolha quais ocorrências desta transação serão afetadas."
    >
      <div className="flex flex-col gap-2">
        {SCOPES.map(({ scope, label }) => (
          <Button
            key={scope}
            type="button"
            variant={action === 'delete' && scope === 'all' ? 'destructive' : 'secondary'}
            className="justify-start"
            loading={submitting && pending === scope}
            disabled={submitting}
            onClick={() => pick(scope)}
          >
            {label}
          </Button>
        ))}

        {rootError ? <p className="text-danger text-sm">{rootError}</p> : null}

        <div className="mt-2 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
