'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BankConnectionDto, BankConnectionStatus } from '@finance/contracts';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, type BadgeProps } from '@finance/ui';
import { CreditCard, History, ListRestart, RefreshCw, ShieldAlert, Wallet } from 'lucide-react';
import { money } from '../../util/money';
import { openPluggyConnect } from './pluggy-connect-widget';
import {
  BANK_CONNECTIONS_QUERY_KEY,
  useCreateConnectToken,
  useDisconnectBankConnection,
  useForceFullSync,
  useRefreshBankConnection,
  useRetryConnectionImports,
} from './use-bank-connections';

const STATUS_LABEL: Record<BankConnectionStatus, string> = {
  active: 'Ativa',
  needs_attention: 'Requer atenção',
  disconnected: 'Desconectada',
};

const STATUS_VARIANT: Record<BankConnectionStatus, BadgeProps['variant']> = {
  active: 'success',
  needs_attention: 'warning',
  disconnected: 'default',
};

export interface ConnectionsListViewProps {
  connections: BankConnectionDto[];
}

export function ConnectionsListView({ connections }: ConnectionsListViewProps) {
  if (connections.length === 0) {
    return <p className="text-text-muted text-sm">Nenhum banco conectado ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {connections.map((connection) => (
        <ConnectionCard key={connection.id} connection={connection} />
      ))}
    </div>
  );
}

function ConnectionCard({ connection }: { connection: BankConnectionDto }) {
  const disconnect = useDisconnectBankConnection();
  const refresh = useRefreshBankConnection();
  const forceFullSync = useForceFullSync();
  const retryImports = useRetryConnectionImports();
  const createConnectToken = useCreateConnectToken();
  const queryClient = useQueryClient();
  const [reauthError, setReauthError] = useState<string | null>(null);
  const isActive = connection.status === 'active';
  const isDisconnected = connection.status === 'disconnected';
  const needsAttention = connection.status === 'needs_attention';

  async function handleReauth() {
    setReauthError(null);
    try {
      const { connectToken } = await createConnectToken.mutateAsync({
        mode: 'reauth',
        bankConnectionId: connection.id,
      });
      await openPluggyConnect(connectToken, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_CONNECTIONS_QUERY_KEY }),
        onError: () => setReauthError('A reautenticação falhou. Tente novamente.'),
      });
    } catch {
      setReauthError('Não foi possível iniciar a reautenticação.');
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle>{connection.institutionName}</CardTitle>
          <Badge variant={STATUS_VARIANT[connection.status]}>
            {STATUS_LABEL[connection.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              loading={refresh.isPending}
              onClick={() => refresh.mutate(connection.id)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Atualizar agora
            </Button>
          ) : null}
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              loading={forceFullSync.isPending}
              onClick={() => forceFullSync.mutate(connection.id)}
            >
              <History className="h-4 w-4" aria-hidden="true" />
              Sincronizar tudo novamente
            </Button>
          ) : null}
          {needsAttention ? (
            <Button
              variant="outline"
              size="sm"
              loading={createConnectToken.isPending}
              onClick={handleReauth}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Reautenticar
            </Button>
          ) : null}
          {!isDisconnected ? (
            <Button
              variant="destructive"
              size="sm"
              loading={disconnect.isPending}
              onClick={() => disconnect.mutate(connection.id)}
            >
              Desconectar
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {reauthError ? <p className="text-danger text-sm">{reauthError}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-text-muted text-sm">
          <span>
            {connection.accounts.length} conta{connection.accounts.length === 1 ? '' : 's'} ·{' '}
            {connection.creditCards.length} cartão{connection.creditCards.length === 1 ? '' : 'ões'} ·{' '}
            {connection.transactionsTotal} transaç{connection.transactionsTotal === 1 ? 'ão' : 'ões'}
            {connection.transactionsErrored > 0 ? ` (${connection.transactionsErrored} com erro)` : ''}
          </span>
          {connection.transactionsErrored > 0 ? (
            <Button
              variant="outline"
              size="sm"
              loading={retryImports.isPending}
              onClick={() => retryImports.mutate(connection.id)}
            >
              <ListRestart className="h-4 w-4" aria-hidden="true" />
              Importar transações pendentes
            </Button>
          ) : null}
        </div>
        {connection.accounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {account.displayName}
            </span>
            <span className="font-medium">{money(account.balance)}</span>
          </div>
        ))}
        {connection.creditCards.map((card) => (
          <div key={card.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {card.brand ?? 'Cartão'} {card.lastDigits ? `•••• ${card.lastDigits}` : ''}
            </span>
            <span className="font-medium">{money(card.currentBalance)}</span>
          </div>
        ))}
        {connection.accounts.length === 0 && connection.creditCards.length === 0 ? (
          <p className="text-text-muted text-sm">Sincronizando dados...</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
