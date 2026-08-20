'use client';

import { Skeleton } from '@finance/ui';
import { ConnectFlow } from './connect-flow';
import { ConnectionsListView } from './connections-list-view';
import { useBankConnections } from './use-bank-connections';

export function BankConnectionsView() {
  const { data: connections, isLoading } = useBankConnections();

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      <ConnectFlow />
      <ConnectionsListView connections={connections ?? []} />
    </div>
  );
}
