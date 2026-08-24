'use client';

import { useRef, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  cn,
  type SelectOption,
} from '@finance/ui';
import { FileText, UploadCloud, X } from 'lucide-react';
import { useCards } from '../cards/use-cards';

export interface InvoiceUploadValues {
  file: File;
  creditCardId: string;
  password?: string;
}

export interface InvoiceUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: InvoiceUploadValues) => Promise<void> | void;
  submitting?: boolean;
  error?: string;
}

/** Human-readable file size, e.g. "1.4 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Collects the credit card, the invoice PDF and its password before extraction. */
export function InvoiceUploadModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
}: InvoiceUploadModalProps) {
  const { data: cards } = useCards();
  const [creditCardId, setCreditCardId] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const cardOptions: SelectOption[] = (cards ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} ••${c.lastDigits}`,
  }));

  function pick(next: File | null | undefined) {
    if (!next) return;
    if (next.type !== 'application/pdf') {
      setLocalError('O arquivo precisa ser um PDF');
      return;
    }
    setLocalError(undefined);
    setFile(next);
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditCardId) return setLocalError('Selecione um cartão');
    if (!file) return setLocalError('Selecione o PDF da fatura');
    setLocalError(undefined);
    await onSubmit({ file, creditCardId, password: password || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar fatura"
      description="Enviamos o PDF e a senha apenas para extração — a senha nunca é armazenada."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Select
          label="Cartão"
          options={cardOptions}
          value={creditCardId}
          onChange={(e) => setCreditCardId(e.target.value)}
          placeholder="Selecione o cartão"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-text text-sm font-medium">PDF da fatura</label>

          {/* Hidden native input — the source of truth, wired to drag/drop + click. */}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />

          {file ? (
            <div className="border-border bg-surface flex items-center gap-3 rounded-card border p-3">
              <span className="bg-primary-soft text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-text truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-text-muted text-xs">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-primary hover:bg-primary-soft rounded-btn px-2.5 py-1 text-sm font-medium transition-colors"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remover arquivo"
                className="text-text-muted hover:text-danger hover:bg-danger-soft flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'rounded-card flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed px-6 py-8 text-center transition-colors',
                'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
                dragging
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface-muted hover:border-primary hover:bg-primary-soft/40',
              )}
            >
              <span className="bg-primary-soft text-primary flex h-12 w-12 items-center justify-center rounded-full">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-text text-sm font-medium">
                Arraste o PDF aqui ou{' '}
                <span className="text-primary">clique para selecionar</span>
              </p>
              <p className="text-text-subtle text-xs">Apenas arquivos PDF</p>
            </div>
          )}
        </div>

        <Input
          label="Senha do PDF (opcional)"
          type="password"
          autoComplete="off"
          placeholder="Deixe em branco se não houver"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {(localError ?? error) && (
          <p className="text-danger text-sm">{localError ?? error}</p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Extraindo…' : 'Extrair transações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
