'use client';

import { useState } from 'react';
import type {
  CommitInvoiceResult,
  InvoiceExtractionResult,
} from '@finance/contracts';
import { Button, Card } from '@finance/ui';
import { CheckCircle2, FileUp } from 'lucide-react';
import { useCategories } from '../categories/use-categories';
import {
  InvoiceUploadModal,
  type InvoiceUploadValues,
} from './invoice-upload-modal';
import {
  InvoiceReviewModal,
  type InvoiceReviewValues,
} from './invoice-review-modal';
import { InvoiceCommitModal } from './invoice-commit-modal';
import { useCommitInvoice, useExtractInvoice } from './use-invoice-import';

export function InvoiceImportView() {
  const extract = useExtractInvoice();
  const commit = useCommitInvoice();
  const { data: categories } = useCategories();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [creditCardId, setCreditCardId] = useState<string>();
  const [extraction, setExtraction] = useState<InvoiceExtractionResult>();
  const [reviewed, setReviewed] = useState<InvoiceReviewValues>();
  const [summary, setSummary] = useState<CommitInvoiceResult>();

  async function handleUpload(values: InvoiceUploadValues) {
    const data = await extract.mutateAsync(values);
    setCreditCardId(values.creditCardId);
    setExtraction(data);
    setUploadOpen(false);
    setReviewOpen(true);
  }

  function handleReviewConfirm(values: InvoiceReviewValues) {
    setReviewed(values);
    setReviewOpen(false);
    setCommitOpen(true);
  }

  async function handleCommit(mode: 'replace' | 'merge') {
    if (!reviewed || !creditCardId) return;
    const result = await commit.mutateAsync({
      creditCardId,
      referenceMonth: reviewed.referenceMonth,
      mode,
      lines: reviewed.lines,
    });
    setSummary(result);
    setCommitOpen(false);
  }

  const keptCount = reviewed?.lines.filter((l) => !l.discarded).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-text text-lg font-semibold">Importar fatura</h1>
          <p className="text-text-muted text-sm">
            Envie o PDF da fatura e extraia as transações com IA.
          </p>
        </div>
        <Button
          onClick={() => {
            extract.reset();
            commit.reset();
            setReviewed(undefined);
            setSummary(undefined);
            setUploadOpen(true);
          }}
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          Enviar PDF
        </Button>
      </div>

      {summary ? (
        <Card className="flex flex-col gap-2 p-6">
          <p className="text-success flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Importação concluída
          </p>
          <p className="text-text-muted text-sm">
            {summary.added} adicionada(s) · {summary.skipped} ignorada(s) ·{' '}
            {summary.removed} removida(s)
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="bg-info-soft text-info flex h-14 w-14 items-center justify-center rounded-full">
            <FileUp className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-text text-sm font-semibold">
              Nenhuma fatura importada
            </p>
            <p className="text-text-muted text-sm">
              Envie um PDF para extrair as transações.
            </p>
          </div>
        </Card>
      )}

      <InvoiceUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
        submitting={extract.isPending}
        error={extract.error?.message}
      />

      {extraction && (
        <InvoiceReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          extraction={extraction}
          categories={categories}
          onConfirm={handleReviewConfirm}
        />
      )}

      <InvoiceCommitModal
        open={commitOpen}
        onClose={() => setCommitOpen(false)}
        keptCount={keptCount}
        onConfirm={handleCommit}
        submitting={commit.isPending}
        error={commit.error?.message}
      />
    </div>
  );
}
