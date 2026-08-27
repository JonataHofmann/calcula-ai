'use client';

import { useState } from 'react';
import type { CreateCreditCardInput, CreditCardDto } from '@finance/contracts';
import { Button, Card, Modal, Skeleton } from '@finance/ui';
import { AnimatePresence, motion } from 'motion/react';
import { CreditCard, Plus } from 'lucide-react';
import { CardItem } from './card-item';
import { CardFormModal } from './card-form-modal';
import { useCards, useCreateCard, useDeleteCard, useUpdateCard } from './use-cards';

export function CardsView() {
  const { data: cards, isLoading } = useCards();
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCardDto | undefined>(undefined);
  const [deleting, setDeleting] = useState<CreditCardDto | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(card: CreditCardDto) {
    setEditing(card);
    setFormOpen(true);
  }

  async function handleSubmit(values: CreateCreditCardInput) {
    if (editing) {
      await updateCard.mutateAsync({ id: editing.id, input: values });
    } else {
      await createCard.mutateAsync(values);
    }
    setFormOpen(false);
    setEditing(undefined);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await deleteCard.mutateAsync(deleting.id);
    setDeleting(undefined);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Cartões de crédito</h1>
          <p className="text-text-muted text-sm">Seus cartões e limites.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo cartão
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,20rem))] gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[16/10] w-full max-w-[20rem] rounded-2xl" />
          ))}
        </div>
      ) : cards && cards.length > 0 ? (
        <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(16rem,20rem))] gap-4">
          <AnimatePresence mode="popLayout">
            {cards.map((card, i) => (
              <CardItem
                key={card.id}
                card={card}
                index={i}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="bg-info-soft text-info flex h-14 w-14 items-center justify-center rounded-full">
            <CreditCard className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Nenhum cartão ainda</p>
            <p className="text-text-muted text-sm">
              Cadastre seu primeiro cartão de crédito para começar.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo cartão
          </Button>
        </Card>
      )}

      <CardFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={handleSubmit}
        initial={editing}
        submitting={createCard.isPending || updateCard.isPending}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        title="Excluir cartão"
        description={
          deleting ? `Tem certeza que deseja excluir "${deleting.name}"?` : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={deleteCard.isPending}
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        }
      >
        <p className="text-text-muted text-sm">Esta ação não pode ser desfeita.</p>
      </Modal>
    </div>
  );
}
