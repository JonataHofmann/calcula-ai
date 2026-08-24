'use client';

import { useState } from 'react';
import type { CommitInvoiceInput } from '@finance/contracts';
import { Button, Modal } from '@finance/ui';
import { Layers, Replace } from 'lucide-react';

type CommitMode = CommitInvoiceInput['mode'];

export interface InvoiceCommitModalProps {
  open: boolean;
  onClose: () => void;
  keptCount: number;
  onConfirm: (mode: CommitMode) => void;
  submitting?: boolean;
  error?: string;
}

const OPTIONS: Array<{
  mode: CommitMode;
  title: string;
  description: string;
  icon: typeof Layers;
}> = [
  {
    mode: 'merge',
    title: 'Mesclar',
    description:
      'Mantém os lançamentos já existentes e adiciona apenas os que não são duplicados.',
    icon: Layers,
  },
  {
    mode: 'replace',
    title: 'Substituir',
    description:
      'Apaga os lançamentos do cartão neste mês e grava somente os desta fatura.',
    icon: Replace,
  },
];

/**
 * Replace/merge decision before persisting (FR-005/FR-012). Merge is the safe default;
 * replace is destructive so it is spelled out. The actual dedup/replace runs on the api.
 */
export function InvoiceCommitModal({
  open,
  onClose,
  keptCount,
  onConfirm,
  submitting,
  error,
}: InvoiceCommitModalProps) {
  const [mode, setMode] = useState<CommitMode>('merge');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Como deseja importar?"
      description={`${keptCount} lançamento(s) serão gravados no cartão.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant={mode === 'replace' ? 'destructive' : 'primary'}
            onClick={() => onConfirm(mode)}
            disabled={submitting}
          >
            {submitting ? 'Importando…' : 'Importar'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              aria-pressed={selected}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                selected
                  ? 'border-primary bg-primary-soft'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span className="text-primary mt-0.5">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-text text-sm font-semibold">
                  {option.title}
                </span>
                <span className="text-text-muted text-sm">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Modal>
  );
}
