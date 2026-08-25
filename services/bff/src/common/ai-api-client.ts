import { Injectable } from '@nestjs/common';
import { outgoingTraceHeaders } from '@finance/observability';
import { UpstreamError, upstreamMessage } from './upstream-error';

/** A PDF upload forwarded from the web through the BFF to ai-ms. */
export interface UploadedInvoice {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

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
}
