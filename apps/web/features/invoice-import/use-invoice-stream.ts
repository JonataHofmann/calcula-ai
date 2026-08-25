'use client';

import { useCallback, useState } from 'react';
import type {
  InvoiceExtractionResult,
  InvoiceImportProgressEvent,
} from '@finance/contracts';
import { extractInvoiceStream, type ExtractInvoiceInput } from './invoice-import-api';

/** Passos visíveis na tela, em ordem. `done`/`error` do stream não são linhas próprias. */
export const IMPORT_STEP_ORDER = [
  'uploading',
  'loading_categories',
  'reading_pdf',
  'extracting_ai',
  'processing',
  'categorizing',
] as const;
export type ImportStepKey = (typeof IMPORT_STEP_ORDER)[number];

const STEP_LABELS: Record<ImportStepKey, string> = {
  uploading: 'Enviando arquivo',
  loading_categories: 'Carregando categorias',
  reading_pdf: 'Extraindo texto do PDF',
  extracting_ai: 'Analisando com a IA',
  processing: 'Processando transações',
  categorizing: 'Categorizando transações',
};

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface ImportStepView {
  key: ImportStepKey;
  label: string;
  status: StepStatus;
  /** Mensagem mais recente do backend para este passo. */
  detail?: string;
}

function initialSteps(): ImportStepView[] {
  return IMPORT_STEP_ORDER.map((key) => ({
    key,
    label: STEP_LABELS[key],
    status: 'pending',
  }));
}

/** Aplica um evento do stream ao array de passos, retornando um novo array. */
function reduceSteps(
  steps: ImportStepView[],
  event: InvoiceImportProgressEvent,
): ImportStepView[] {
  // `done` terminal: tudo concluído.
  if (event.step === 'done') {
    return steps.map((s) => ({ ...s, status: 'done' }));
  }
  // `error`: marca o primeiro passo ainda ativo/pendente como erro; anteriores ficam done.
  if (event.step === 'error') {
    let marked = false;
    return steps.map((s) => {
      if (marked) return s;
      if (s.status === 'active' || s.status === 'pending') {
        marked = true;
        return { ...s, status: 'error', detail: event.message };
      }
      return s;
    });
  }
  // Passo normal: start -> active, done -> done. Passos anteriores viram done.
  const idx = IMPORT_STEP_ORDER.indexOf(event.step as ImportStepKey);
  if (idx < 0) return steps;
  return steps.map((s, i) => {
    if (i < idx) return s.status === 'pending' ? { ...s, status: 'done' } : s;
    if (i > idx) return s;
    return {
      ...s,
      status: event.status === 'done' ? 'done' : 'active',
      detail: event.message,
    };
  });
}

export interface UseInvoiceStreamResult {
  steps: ImportStepView[];
  isRunning: boolean;
  error?: string;
  /** Roda a extração streamed; resolve com o resultado ou lança em erro. */
  run: (input: ExtractInvoiceInput) => Promise<InvoiceExtractionResult>;
  reset: () => void;
}

/**
 * Gerencia o estado do progresso passo a passo da importação de fatura, atualizando a
 * lista de passos em tempo real conforme os eventos NDJSON chegam do BFF.
 */
export function useInvoiceStream(): UseInvoiceStreamResult {
  const [steps, setSteps] = useState<ImportStepView[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>();

  const reset = useCallback(() => {
    setSteps(initialSteps());
    setIsRunning(false);
    setError(undefined);
  }, []);

  const run = useCallback(async (input: ExtractInvoiceInput) => {
    setSteps(initialSteps());
    setError(undefined);
    setIsRunning(true);
    try {
      const result = await extractInvoiceStream(input, (event) => {
        setSteps((prev) => reduceSteps(prev, event));
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na importação';
      setError(message);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { steps, isRunning, error, run, reset };
}
