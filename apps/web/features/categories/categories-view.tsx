'use client';

import { useState } from 'react';
import type { CategoryNodeDto } from '@finance/contracts';
import { Button, Card, Modal, Skeleton } from '@finance/ui';
import { FolderTree, Plus } from 'lucide-react';
import { CategoryTree, type CategoryTreeCallbacks } from './category-tree';
import {
  CategoryFormModal,
  type CategoryFormMode,
  type CategoryFormValues,
} from './category-form-modal';
import {
  useAddSubcategory,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRevertOverride,
  useUpdateCategory,
} from './use-categories';

interface FormState {
  mode: CategoryFormMode;
  initial?: CategoryFormValues;
  parent?: CategoryNodeDto;
  editingId?: string;
}

export function CategoriesView() {
  const { data: tree, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const addSubcategory = useAddSubcategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const revertOverride = useRevertOverride();

  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<CategoryNodeDto | undefined>(undefined);

  function openCreate() {
    setForm({ mode: 'create' });
  }

  function openEdit(node: CategoryNodeDto) {
    setForm({
      mode: 'edit',
      editingId: node.id,
      initial: { name: node.name, type: node.type, icon: node.icon, color: node.color },
    });
  }

  function openAddSub(node: CategoryNodeDto) {
    setForm({
      mode: 'subcategory',
      parent: node,
      initial: { name: '', type: node.type, icon: 'tag', color: node.color },
    });
  }

  async function handleSubmit(values: CategoryFormValues) {
    if (!form) return;
    if (form.mode === 'create') {
      await createCategory.mutateAsync({
        name: values.name,
        type: values.type,
        icon: values.icon,
        color: values.color,
      });
    } else if (form.mode === 'edit' && form.editingId) {
      await updateCategory.mutateAsync({
        id: form.editingId,
        input: { name: values.name, icon: values.icon, color: values.color },
      });
    } else if (form.mode === 'subcategory' && form.parent) {
      await addSubcategory.mutateAsync({
        parentId: form.parent.id,
        input: { name: values.name, icon: values.icon, color: values.color },
      });
    }
    setForm(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    await deleteCategory.mutateAsync(deleting.id);
    setDeleting(undefined);
  }

  const callbacks = {
    onAddSub: openAddSub,
    onEdit: openEdit,
    onDelete: setDeleting,
    onRevert: (node: CategoryNodeDto) => revertOverride.mutate(node.id),
  };

  const isEmpty =
    !isLoading && tree && tree.expense.length === 0 && tree.income.length === 0;
  const deletingDefault = deleting ? deleting.source !== 'custom' : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Categorias</h1>
          <p className="text-text-muted text-sm">
            Organize despesas e receitas com categorias e subcategorias.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-card" />
          ))}
        </div>
      ) : isEmpty ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="bg-info-soft text-info flex h-14 w-14 items-center justify-center rounded-full">
            <FolderTree className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">Nenhuma categoria</p>
            <p className="text-text-muted text-sm">
              Crie sua primeira categoria para organizar suas finanças.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova categoria
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategorySection
            title="Despesas"
            nodes={tree?.expense ?? []}
            callbacks={callbacks}
          />
          <CategorySection
            title="Receitas"
            nodes={tree?.income ?? []}
            callbacks={callbacks}
          />
        </div>
      )}

      {form ? (
        <CategoryFormModal
          open
          mode={form.mode}
          initial={form.initial}
          parentName={form.parent?.name}
          onClose={() => setForm(null)}
          onSubmit={handleSubmit}
          submitting={
            createCategory.isPending ||
            updateCategory.isPending ||
            addSubcategory.isPending
          }
        />
      ) : null}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        title={deletingDefault ? 'Ocultar categoria' : 'Excluir categoria'}
        description={
          deleting
            ? deletingDefault
              ? `Ocultar "${deleting.name}" apenas para você?`
              : `Tem certeza que deseja excluir "${deleting.name}"?`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              loading={deleteCategory.isPending}
              onClick={confirmDelete}
            >
              {deletingDefault ? 'Ocultar' : 'Excluir'}
            </Button>
          </div>
        }
      >
        <p className="text-text-muted text-sm">
          {deletingDefault
            ? 'A categoria padrão continua disponível para outros usuários.'
            : 'Subcategorias associadas também serão excluídas. Esta ação não pode ser desfeita.'}
        </p>
      </Modal>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  nodes: CategoryNodeDto[];
  callbacks: CategoryTreeCallbacks;
}

function CategorySection({ title, nodes, callbacks }: CategorySectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {nodes.length > 0 ? (
        <CategoryTree nodes={nodes} {...callbacks} />
      ) : (
        <Card className="text-text-muted p-6 text-center text-sm">
          Nenhuma categoria de {title.toLowerCase()}.
        </Card>
      )}
    </section>
  );
}
