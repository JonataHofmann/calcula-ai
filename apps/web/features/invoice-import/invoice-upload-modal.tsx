'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  type SelectOption,
} from '@finance/ui';
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
  const [localError, setLocalError] = useState<string>();

  const cardOptions: SelectOption[] = (cards ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} ••${c.lastDigits}`,
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditCardId) return setLocalError('Selecione um cartão');
    if (!file) return setLocalError('Selecione o PDF da fatura');
    setLocalError(undefined);
    await onSubmit({
      file,
      creditCardId,
      password: password || undefined,
    });
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">PDF da fatura</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
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
          <p className="text-sm text-red-600">{localError ?? error}</p>
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
