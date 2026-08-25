import { Injectable } from '@nestjs/common';
import { outgoingTraceHeaders } from '@finance/observability';
import type { InvoiceImportProgressEvent } from '@finance/contracts';
import { UpstreamError, upstreamMessage } from './upstream-error';

/** A PDF upload forwarded from the web through the BFF to ai-ms. */
export interface UploadedInvoice {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

/** Callback de progresso repassado ao cliente durante o stream de extração. */
export type InvoiceStepEmitter = (event: InvoiceImportProgressEvent) => void;

/**
 * Thin HTTP client for BFF -> ai-ms calls. Streams the uploaded PDF as multipart,
 * forwarding the user's access token as a Bearer credential. Never sets Content-Type
 * manually — fetch derives the multipart boundary from the FormData body.
 * The PDF password rides in the form fields and is never logged.
 */
@Injectable()
export class AiApiClient {
  private readonly service = 'ai-ms';
  private readonly base = process.env.AI_MS_URL ?? 'http://localhost:3033';

  async extractInvoice<T>(
    token: string,
    file: UploadedInvoice,
    fields: Record<string, string>,
  ): Promise<T> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype,
    });
    form.append('file', blob, file.filename);
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }

    let res: Response;
    try {
      res = await fetch(`${this.base}/invoice-extract`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...outgoingTraceHeaders() },
        body: form,
      });
    } catch (cause) {
      throw new UpstreamError({
        service: this.service,
        status: 502,
        message: `Falha de rede ao contatar ${this.service} (POST /invoice-extract): ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        cause,
      });
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new UpstreamError({
        service: this.service,
        status: res.status,
        upstreamStatus: res.status,
        body: data,
        message:
          upstreamMessage(data) ?? res.statusText ?? `Erro ${res.status} em ${this.service}`,
      });
    }
    return data as T;
  }

  /**
   * Igual a extractInvoice, mas consome o NDJSON de progresso do ai-ms: repassa cada
   * evento de passo via `onEvent` e resolve com o resultado bruto (do evento `done` do
   * ai-ms, que NÃO é repassado — o BFF ainda vai enriquecer e emitir o `done` final).
   * Um evento `error` do ai-ms vira UpstreamError para o chamador emitir o erro ao cliente.
   */
  async extractInvoiceStream<T>(
    token: string,
    file: UploadedInvoice,
    fields: Record<string, string>,
    onEvent: InvoiceStepEmitter,
  ): Promise<T> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    form.append('file', blob, file.filename);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    let res: Response;
    try {
      res = await fetch(`${this.base}/invoice-extract/stream`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...outgoingTraceHeaders() },
        body: form,
      });
    } catch (cause) {
      throw new UpstreamError({
        service: this.service,
        status: 502,
        message: `Falha de rede ao contatar ${this.service} (POST /invoice-extract/stream): ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        cause,
      });
    }

    // Erro ANTES do stream começar (ex.: validação 400) — corpo é JSON de erro comum.
    if (!res.ok) {
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        data = text;
      }
      throw new UpstreamError({
        service: this.service,
        status: res.status,
        upstreamStatus: res.status,
        body: data,
        message:
          upstreamMessage(data) ?? res.statusText ?? `Erro ${res.status} em ${this.service}`,
      });
    }
    if (!res.body) {
      throw new UpstreamError({
        service: this.service,
        status: 502,
        message: `${this.service} não retornou corpo de stream`,
      });
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let result: T | undefined;

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const event = JSON.parse(trimmed) as InvoiceImportProgressEvent;
      if (event.step === 'error') {
        throw new UpstreamError({
          service: this.service,
          status: KNOWN_ERROR_STATUS[event.code ?? ''] ?? 502,
          upstreamStatus: KNOWN_ERROR_STATUS[event.code ?? ''] ?? 502,
          body: event,
          message: event.message,
        });
      }
      if (event.step === 'done') {
        // Resultado bruto do ai-ms (sem enriquecimento). Não repassa este `done`.
        result = event.result as T;
        return;
      }
      onEvent(event);
    };

    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        handleLine(line);
      }
    }
    if (buffer.length > 0) handleLine(buffer);

    if (result === undefined) {
      throw new UpstreamError({
        service: this.service,
        status: 502,
        message: `${this.service} encerrou o stream sem resultado`,
      });
    }
    return result;
  }
}

/** Códigos de erro conhecidos do ai-ms -> status HTTP (só cosmético mid-stream). */
const KNOWN_ERROR_STATUS: Record<string, number> = {
  INVALID_PDF_PASSWORD: 400,
  UNREADABLE_PDF: 400,
  EXTRACTION_FAILED: 422,
};
