'use client';

import { useState } from 'react';
import { Button, Card, Input, Modal } from '@finance/ui';
import { AlertTriangle } from 'lucide-react';
import { useResetData } from './use-settings';

/** Word the user must type to arm the irreversible reset. */
const CONFIRM_WORD = 'RESETAR';

export function SettingsView() {
  const reset = useResetData();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setOpen(false);
    setTyped('');
    reset.reset();
  }

  async function confirm() {
    if (!armed) return;
    await reset.mutateAsync();
    setOpen(false);
    setTyped('');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-text text-lg font-semibold">Configurações</h1>
        <p className="text-text-muted text-sm">Gerencie os dados da sua conta.</p>
      </div>

      <Card className="border-danger/40 flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="bg-danger-soft text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Resetar dados</p>
            <p className="text-text-muted text-sm">
              Apaga todas as suas transações, contas, cartões e categorias personalizadas.
              As categorias padrão do sistema e o seu login são mantidos. Esta ação não pode
              ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Resetar dados
          </Button>
        </div>
      </Card>

      {reset.isSuccess && reset.data ? (
        <p className="text-text-muted text-sm" role="status">
          Dados apagados: {reset.data.transactions} transação(ões), {reset.data.accounts}{' '}
          conta(s), {reset.data.creditCards} cartão(ões), {reset.data.categories}{' '}
          categoria(s).
        </p>
      ) : null}

      <Modal
        open={open}
        onClose={close}
        title="Resetar todos os dados"
        description={`Isto apaga tudo permanentemente. Digite ${CONFIRM_WORD} para confirmar.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!armed}
              loading={reset.isPending}
              onClick={confirm}
            >
              Apagar tudo
            </Button>
          </div>
        }
      >
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={CONFIRM_WORD}
          aria-label="Confirmação"
          autoFocus
        />
      </Modal>
    </div>
  );
}
