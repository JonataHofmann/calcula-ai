'use client';

import { useState, type ReactNode } from 'react';
import type { CategoryNodeDto } from '@finance/contracts';
import {
  Badge,
  COLOR_TOKEN_SOFT_BG,
  COLOR_TOKEN_TEXT,
  getIcon,
} from '@finance/ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GripVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

export interface CategoryTreeCallbacks {
  onAddSub: (node: CategoryNodeDto) => void;
  onEdit: (node: CategoryNodeDto, isSub: boolean) => void;
  onDelete: (node: CategoryNodeDto) => void;
  onRevert: (node: CategoryNodeDto) => void;
  /** Reparent by drag-and-drop. `parentId: null` promotes the node to a root. */
  onMove: (id: string, parentId: string | null) => void;
}

export interface CategoryTreeProps extends CategoryTreeCallbacks {
  nodes: CategoryNodeDto[];
}

/** Sentinel droppable id for the "make it a root" zone. */
const PROMOTE_ID = '__promote__';

export function CategoryTree({ nodes, ...cb }: CategoryTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    // A small distance keeps the row's action buttons clickable — a drag only starts on real movement.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Flat lookups over the two-level tree, rebuilt each render (cheap; lists are short).
  const byId = new Map<string, CategoryNodeDto>();
  const parentOf = new Map<string, string | null>();
  for (const root of nodes) {
    byId.set(root.id, root);
    parentOf.set(root.id, null);
    for (const child of root.children) {
      byId.set(child.id, child);
      parentOf.set(child.id, root.id);
    }
  }

  const activeNode = activeId ? byId.get(activeId) : undefined;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveId(null);
    if (!overId || overId === id) return;

    const node = byId.get(id);
    if (!node) return;
    const currentParent = parentOf.get(id) ?? null;

    if (overId === PROMOTE_ID) {
      if (currentParent === null) return; // already a root
      cb.onMove(id, null);
      return;
    }

    // Otherwise `overId` is a root: nest `id` under it.
    if (node.children.length > 0) return; // a node with children can't be nested (keeps two levels)
    if (currentParent === overId) return; // no-op
    cb.onMove(id, overId);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <motion.ul layout className="flex flex-col gap-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {nodes.map((node) => (
            <CategoryNode key={node.id} node={node} depth={0} activeId={activeId} {...cb} />
          ))}
        </AnimatePresence>
      </motion.ul>

      <PromoteZone visible={activeId !== null && parentOf.get(activeId) !== null} />

      <DragOverlay dropAnimation={null}>
        {activeNode ? <NodePreview node={activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface CategoryNodeProps extends CategoryTreeCallbacks {
  node: CategoryNodeDto;
  depth: number;
  activeId: string | null;
}

function CategoryNode({ node, depth, activeId, ...cb }: CategoryNodeProps) {
  const reduce = useReducedMotion();
  const Icon = getIcon(node.icon);
  const isDefault = node.source !== 'custom';
  const isRoot = depth === 0;

  const draggable = useDraggable({ id: node.id });
  const droppable = useDroppable({ id: node.id, disabled: !isRoot });

  const isDragging = activeId === node.id;
  // Highlight a root as a nest target while another node is being dragged over it.
  const canDrop = isRoot && droppable.isOver && activeId !== null && activeId !== node.id;

  return (
    <motion.li
      ref={draggable.setNodeRef}
      layout
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16 }}
    >
      <div
        ref={isRoot ? droppable.setNodeRef : undefined}
        className={`flex items-center gap-2 rounded-card border px-3 py-2 transition-all ${
          canDrop
            ? 'border-primary bg-primary-soft'
            : 'border-border/60 hover:border-border hover:bg-surface-2 hover:shadow-card'
        }`}
      >
        <button
          type="button"
          aria-label={`Reordenar ${node.name}`}
          className="text-text-muted hover:text-text -ml-1 cursor-grab touch-none rounded-icon p-1 active:cursor-grabbing"
          {...draggable.listeners}
          {...draggable.attributes}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${COLOR_TOKEN_SOFT_BG[node.color]} ${COLOR_TOKEN_TEXT[node.color]}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-text truncate text-sm font-medium">{node.name}</span>
          {node.source === 'default-overridden' ? (
            <Badge variant="info">Editado</Badge>
          ) : node.source === 'custom' ? (
            <Badge>Personalizado</Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label={`Adicionar subcategoria em ${node.name}`}
            onClick={() => cb.onAddSub(node)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          {node.source === 'default-overridden' ? (
            <IconButton
              label={`Reverter edição de ${node.name}`}
              onClick={() => cb.onRevert(node)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton label={`Editar ${node.name}`} onClick={() => cb.onEdit(node, depth > 0)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${isDefault ? 'Ocultar' : 'Excluir'} ${node.name}`}
            variant="danger"
            onClick={() => cb.onDelete(node)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {node.children.length > 0 ? (
        <div className="border-border/60 mt-1 ml-[18px] border-l pl-4">
          <motion.ul layout className="flex flex-col gap-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {node.children.map((child) => (
                <CategoryNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  activeId={activeId}
                  {...cb}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        </div>
      ) : null}
    </motion.li>
  );
}

/** Drop zone shown while dragging a non-root node — dropping here promotes it back to a root. */
function PromoteZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: PROMOTE_ID });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`mt-2 rounded-card border border-dashed px-3 py-3 text-center text-sm transition-colors ${
        isOver ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-muted'
      }`}
    >
      Solte aqui para tornar uma categoria principal
    </div>
  );
}

/** Compact card rendered under the cursor while dragging. */
function NodePreview({ node }: { node: CategoryNodeDto }) {
  const Icon = getIcon(node.icon);
  return (
    <div className="border-border bg-surface flex items-center gap-2 rounded-card border px-3 py-2 shadow-card">
      <GripVertical className="text-text-muted h-4 w-4" aria-hidden="true" />
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${COLOR_TOKEN_SOFT_BG[node.color]} ${COLOR_TOKEN_TEXT[node.color]}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-text text-sm font-medium">{node.name}</span>
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  children: ReactNode;
}

function IconButton({ label, onClick, variant = 'default', children }: IconButtonProps) {
  const hover =
    variant === 'danger'
      ? 'hover:bg-danger-soft hover:text-danger'
      : 'hover:bg-surface hover:text-text';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`text-text-muted focus-visible:ring-focus-ring rounded-icon p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none ${hover}`}
    >
      {children}
    </button>
  );
}
