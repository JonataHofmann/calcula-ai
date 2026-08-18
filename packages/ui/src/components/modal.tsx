'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width utility class of the panel. */
  className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Close on Escape (document-level so it works regardless of focus).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the panel on open.
  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    if (!node) return;
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus();
  }, [open]);

  const trapFocus = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const node = panelRef.current;
    if (!node) return;
    const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const duration = reduceMotion ? 0 : 0.2;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
        >
          <div
            className="bg-text/40 absolute inset-0 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            onKeyDown={trapFocus}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration, ease: 'easeOut' }}
            className={cn(
              'bg-surface text-text rounded-card shadow-shell relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden',
              className ?? 'max-w-lg',
            )}
          >
            {title ? (
              <div className="border-border flex items-start justify-between gap-4 border-b px-6 py-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  {description ? (
                    <p className="text-text-muted text-sm">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="text-text-muted hover:bg-background hover:text-text focus-visible:ring-focus-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer ? (
              <div className="border-border bg-background/40 flex justify-end gap-2 border-t px-6 py-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
