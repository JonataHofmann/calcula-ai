// Mesma origem via proxy reverso do Next (`/bff/*` -> BFF). Relativo, sem CORS
// e sem cookie cross-subdomínio. Override só se apontar direto pro BFF.
const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? '/bff';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BFF_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Multipart upload variant. Never sets Content-Type so the browser derives the
 * multipart boundary from the FormData body. Surfaces the upstream error message
 * (e.g. senha inválida) when present.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const response = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed: ${response.status}`;
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: unknown };
        if (typeof body.message === 'string') message = body.message;
      } catch {
        /* non-JSON error body: keep the default message */
      }
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Multipart upload que consome uma resposta NDJSON em streaming: chama `onLine` para
 * cada linha (uma JSON por evento) assim que chega, em tempo real. Erros ANTES do stream
 * (ex.: validação) chegam como corpo JSON e viram ApiError com a mensagem do upstream.
 */
export async function apiUploadStream(
  path: string,
  formData: FormData,
  onLine: (line: string) => void,
): Promise<void> {
  const response = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    let message = `Request failed: ${response.status}`;
    if (text) {
      try {
        const body = JSON.parse(text) as { message?: unknown };
        if (typeof body.message === 'string') message = body.message;
      } catch {
        /* non-JSON error body: keep the default message */
      }
    }
    throw new ApiError(response.status, message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      onLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer.trim()) onLine(buffer);
}

/** RFC4122-ish idempotency key for write requests. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
