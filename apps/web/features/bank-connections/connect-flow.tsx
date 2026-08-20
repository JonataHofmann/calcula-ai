'use client';

import { useState } from 'react';
import { Button } from '@finance/ui';
import { Landmark } from 'lucide-react';
import { useCompleteBankConnection, useCreateConnectToken } from './use-bank-connections';
import { openPluggyConnect } from './pluggy-connect-widget';

/** Opens the Pluggy Connect widget and completes the bank-connection flow on success. */
export function ConnectFlow() {
  const [error, setError] = useState<string | null>(null);
  const createConnectToken = useCreateConnectToken();
  const completeBankConnection = useCompleteBankConnection();

  async function handleConnect() {
    setError(null);
    try {
      const { connectToken } = await createConnectToken.mutateAsync({ mode: 'create' });
      await openPluggyConnect(connectToken, {
        onSuccess: (itemId) => {
          completeBankConnection.mutate(
            { pluggyItemId: itemId },
            { onError: () => setError('Não foi possível concluir a conexão com o banco.') },
          );
        },
        onError: () => setError('A conexão com o banco falhou. Tente novamente.'),
      });
    } catch {
      setError('Não foi possível iniciar a conexão com o banco.');
    }
  }

  const loading = createConnectToken.isPending || completeBankConnection.isPending;

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleConnect} loading={loading}>
        <Landmark aria-hidden="true" />
        Conectar banco
      </Button>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
