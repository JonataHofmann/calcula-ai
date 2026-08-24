import { HttpException, Injectable } from '@nestjs/common';

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

    const res = await fetch(`${this.base}/invoice-extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      throw new HttpException(data ?? { message: res.statusText }, res.status);
    }
    return data as T;
  }
}
