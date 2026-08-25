'use client';

import { Button, Modal, cn } from '@finance/ui';
import { AlertCircle, Check, Circle, Loader2 } from 'lucide-react';
import type { ImportStepView } from './use-invoice-stream';

export interface InvoiceProgressModalProps {
  open: boolean;
  steps: ImportStepView[];
  /** Preenchido quando o fluxo falhou; mostra o erro e o botão de fechar. */
  error?: string;
  onClose: () => void;
}

/** Ícone do passo conforme o status. */
function StepIcon({ status }: { status: ImportStepView['status'] }) {
  if (status === 'done') {
    return <Check className="text-success h-4 w-4" aria-hidden="true" />;
  }
  if (status === 'active') {
    return <Loader2 className="text-primary h-4 w-4 animate-spin" aria-hidden="true" />;
  }
  if (status === 'error') {
    return <AlertCircle className="text-danger h-4 w-4" aria-hidden="true" />;
  }
  return <Circle className="text-text-subtle h-4 w-4" aria-hidden="true" />;
}

/** Mostra o passo a passo da importação em tempo real (enviando, IA, processando…). */
export function InvoiceProgressModal({
  open,
  steps,
  error,
  onClose,
}: InvoiceProgressModalProps) {
  const failed = Boolean(error);
  return (
    <Modal
      open={open}
      onClose={failed ? onClose : () => {}}
      title="Importando fatura"
      description={
        failed
          ? 'A importação falhou. Veja o passo onde parou abaixo.'
          : 'Acompanhe o processamento em tempo real.'
      }
    >
      <ol className="flex flex-col gap-1">
        {steps.map((step) => (
          <li
            key={step.key}
            className={cn(
              'flex items-center gap-3 rounded-btn px-2 py-2 transition-colors',
              step.status === 'active' && 'bg-primary-soft/40',
              step.status === 'error' && 'bg-danger-soft/40',
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <StepIcon status={step.status} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate text-sm',
                  step.status === 'pending' && 'text-text-subtle',
                  step.status === 'active' && 'text-text font-medium',
                  step.status === 'done' && 'text-text',
                  step.status === 'error' && 'text-danger font-medium',
                )}
              >
                {step.label}
              </p>
              {step.status !== 'pending' && step.detail && step.detail !== step.label && (
                <p className="text-text-muted truncate text-xs">{step.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {failed && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-danger text-sm">{error}</p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
