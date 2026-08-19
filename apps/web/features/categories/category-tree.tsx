'use client';

import type { ReactNode } from 'react';
import type { CategoryNodeDto } from '@finance/contracts';
import {
  Badge,
  COLOR_TOKEN_SOFT_BG,
  COLOR_TOKEN_TEXT,
  getIcon,
} from '@finance/ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';

export interface CategoryTreeCallbacks {
  onAddSub: (node: CategoryNodeDto) => void;
  onEdit: (node: CategoryNodeDto) => void;
  onDelete: (node: CategoryNodeDto) => void;
  onRevert: (node: CategoryNodeDto) => void;
}

export interface CategoryTreeProps extends CategoryTreeCallbacks {
  nodes: CategoryNodeDto[];
}

export function CategoryTree({ nodes, ...cb }: CategoryTreeProps) {
  return (
    <motion.ul layout className="flex flex-col gap-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {nodes.map((node) => (
          <CategoryNode key={node.id} node={node} depth={0} {...cb} />
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

interface CategoryNodeProps extends CategoryTreeCallbacks {
  node: CategoryNodeDto;
  depth: number;
}

function CategoryNode({ node, depth, ...cb }: CategoryNodeProps) {
  const reduce = useReducedMotion();
  const Icon = getIcon(node.icon);
  const isDefault = node.source !== 'custom';

  return (
    <motion.li
      layout
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16 }}
    >
      <div className="border-border/60 hover:border-border hover:bg-surface-2 hover:shadow-card flex items-center gap-3 rounded-card border px-3 py-2 transition-all">
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
          <IconButton label={`Editar ${node.name}`} onClick={() => cb.onEdit(node)}>
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
                <CategoryNode key={child.id} node={child} depth={depth + 1} {...cb} />
              ))}
            </AnimatePresence>
          </motion.ul>
        </div>
      ) : null}
    </motion.li>
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
