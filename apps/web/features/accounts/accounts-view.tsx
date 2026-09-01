'use client';

import { useState } from 'react';
import type { AccountDto, CreateAccountInput } from '@finance/contracts';
import { Button, Card, Checkbox, Modal, Skeleton } from '@finance/ui';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Wallet } from 'lucide-react';
import { AccountCard } from './account-card';
import { AccountFormModal } from './account-form-modal';
import {
  useAccountTransactionCount,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from './use-accounts';

export function AccountsView() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountDto | undefined>(undefined);
  const [deleting, setDeleting] = useState<AccountDto | undefined>(undefined);
  const [deleteTx, setDeleteTx] = useState(false);
  const txCount = useAccountTransactionCount(deleting?.id);
  const linkedCount = txCount.data?.count ?? 0;

  function openDelete(account: AccountDto) {
    setDeleteTx(false);
    setDeleting(account);
  }

  function closeDelete() {
    setDeleting(undefined);
    setDeleteTx(false);
  }

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(account: AccountDto) {
    setEditing(account);
    setFormOpen(true);
  }

  async function handleSubmit(values: CreateAccountInput) {
    if (editing) {
      await updateAccount.mutateAsync({ id: editing.id, input: values });
    } else {
      await createAccount.mutateAsync(values);
    }
    setFormOpen(false);
    setEditing(undefined);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await deleteAccount.mutateAsync({ id: deleting.id, deleteTransactions: deleteTx });
    closeDelete();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Contas</h1>
          <p className="text-text-muted text-sm">Suas contas bancárias e carteiras.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova conta
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-card" />
          ))}
        </div>
      ) : accounts && accounts.length > 0 ? (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={openEdit}
                onDelete={openDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="bg-info-soft text-info flex h-14 w-14 items-center justify-center rounded-full">
            <Wallet className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Nenhuma conta ainda</p>
            <p className="text-text-muted text-sm">
              Cadastre sua primeira conta para começar.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova conta
          </Button>
        </Card>
      )}

      <AccountFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={handleSubmit}
        initial={editing}
        submitting={createAccount.isPending || updateAccount.isPending}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={closeDelete}
        title="Excluir conta"
        description={
          deleting ? `Tem certeza que deseja excluir "${deleting.name}"?` : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDelete}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={deleteAccount.isPending}
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        }
      >
        <p className="text-text-muted text-sm">Esta ação não pode ser desfeita.</p>
        {linkedCount > 0 && (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <Checkbox
              checked={deleteTx}
              onChange={(e) => setDeleteTx(e.target.checked)}
              disabled={txCount.isLoading}
            />
            <span className="text-text-muted">
              Excluir também as {linkedCount} transações vinculadas a esta conta.
            </span>
          </label>
        )}
      </Modal>
    </div>
  );
}
