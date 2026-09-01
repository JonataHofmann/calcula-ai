'use client';

import { useState } from 'react';
import type { CategoryNodeDto } from '@finance/contracts';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Modal,
  Skeleton,
  type BadgeProps,
} from '@finance/ui';
import { FolderTree, Plus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { CategoryTree, type CategoryTreeCallbacks } from './category-tree';
import {
  CategoryFormModal,
  type CategoryFormMode,
  type CategoryFormValues,
} from './category-form-modal';
import {
  useAddSubcategory,
  useCategories,
  useCategoryTransactionCount,
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
  /** Color is inherited (subcategory create, or editing a subcategory). */
  lockColor?: boolean;
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
  const [deleteTx, setDeleteTx] = useState(false);
  const txCount = useCategoryTransactionCount(deleting?.id);
  const linkedCount = txCount.data?.count ?? 0;

  function openDelete(node: CategoryNodeDto) {
    setDeleteTx(false);
    setDeleting(node);
  }

  function closeDelete() {
    setDeleting(undefined);
    setDeleteTx(false);
  }

  function openCreate() {
    setForm({ mode: 'create' });
  }

  function openEdit(node: CategoryNodeDto, isSub: boolean) {
    setForm({
      mode: 'edit',
      editingId: node.id,
      initial: { name: node.name, type: node.type, icon: node.icon, color: node.color },
      lockColor: isSub,
    });
  }

  function openAddSub(node: CategoryNodeDto) {
    setForm({
      mode: 'subcategory',
      parent: node,
      initial: { name: '', type: node.type, icon: 'tag', color: node.color },
      lockColor: true,
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
    await deleteCategory.mutateAsync({ id: deleting.id, deleteTransactions: deleteTx });
    closeDelete();
  }

  const callbacks = {
    onAddSub: openAddSub,
    onEdit: openEdit,
    onDelete: openDelete,
    onRevert: (node: CategoryNodeDto) => revertOverride.mutate(node.id),
  };

  const isEmpty =
    !isLoading && tree && tree.expense.length === 0 && tree.income.length === 0;
  const deletingDefault = deleting ? deleting.source !== 'custom' : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            icon={TrendingDown}
            tone="danger"
            nodes={tree?.expense ?? []}
            callbacks={callbacks}
          />
          <CategorySection
            title="Receitas"
            icon={TrendingUp}
            tone="success"
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
          lockColor={form.lockColor}
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
        onClose={closeDelete}
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
            <Button variant="secondary" onClick={closeDelete}>
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
        {linkedCount > 0 && (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <Checkbox
              checked={deleteTx}
              onChange={(e) => setDeleteTx(e.target.checked)}
              disabled={txCount.isLoading}
            />
            <span className="text-text-muted">
              Excluir também as {linkedCount} transações vinculadas (inclui subcategorias).
            </span>
          </label>
        )}
      </Modal>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  icon: LucideIcon;
  tone: 'danger' | 'success';
  nodes: CategoryNodeDto[];
  callbacks: CategoryTreeCallbacks;
}

const TONE_BADGE: Record<CategorySectionProps['tone'], BadgeProps['variant']> = {
  danger: 'danger',
  success: 'success',
};

const TONE_ICON_BG: Record<CategorySectionProps['tone'], string> = {
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
};

function CategorySection({ title, icon: Icon, tone, nodes, callbacks }: CategorySectionProps) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <CardHeader className="flex-row items-center justify-between gap-3 p-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_ICON_BG[tone]}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-text text-sm font-semibold">{title}</h2>
        </div>
        <Badge variant={TONE_BADGE[tone]}>{nodes.length}</Badge>
      </CardHeader>
      {nodes.length > 0 ? (
        <CategoryTree nodes={nodes} {...callbacks} />
      ) : (
        <p className="text-text-muted py-6 text-center text-sm">
          Nenhuma categoria de {title.toLowerCase()}.
        </p>
      )}
    </Card>
  );
}
