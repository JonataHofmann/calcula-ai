import { HttpException } from '@nestjs/common';

export interface UpstreamErrorInfo {
  /** Nome do microserviço de origem: 'api-ms' | 'ai-ms' | 'banking-ms'. */
  service: string;
  /** Status que o BFF vai devolver ao cliente. */
  status: number;
  /** Status original do upstream (undefined em falha de rede). */
  upstreamStatus?: number;
  /** Corpo de erro do upstream (JSON ou texto cru). */
  body?: unknown;
  /** Mensagem legível. */
  message: string;
  /** Erro original (ex.: ECONNREFUSED) — vira `cause` no log/response. */
  cause?: unknown;
}

/**
 * Erro de uma chamada BFF -> microserviço. Estende HttpException para o filtro global
 * espelhar o status e expor QUAL serviço falhou, o status/corpo do upstream e a causa.
 */
export class UpstreamError extends HttpException {
  readonly service: string;
  readonly upstreamStatus?: number;
  readonly upstreamBody?: unknown;
  readonly upstreamCause?: unknown;

  constructor(info: UpstreamErrorInfo) {
    super(
      {
        message: info.message,
        service: info.service,
        upstreamStatus: info.upstreamStatus,
      },
      info.status,
      { cause: info.cause instanceof Error ? info.cause : undefined },
    );
    this.service = info.service;
    this.upstreamStatus = info.upstreamStatus;
    this.upstreamBody = info.body;
    this.upstreamCause = info.cause;
  }
}

/** Extrai `.message` de um corpo de erro upstream (objeto/array/string). */
export function upstreamMessage(body: unknown): string | undefined {
  if (typeof body === 'string' && body.length > 0) return body;
  if (body && typeof body === 'object') {
    const m = (body as { message?: unknown }).message;
    if (Array.isArray(m)) return m.join('; ');
    if (typeof m === 'string') return m;
  }
  return undefined;
}
