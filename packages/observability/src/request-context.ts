import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(partial: Partial<RequestContext>, fn: () => T): T {
  const context: RequestContext = {
    requestId: partial.requestId ?? randomUUID(),
    correlationId: partial.correlationId ?? partial.requestId ?? randomUUID(),
    userId: partial.userId,
  };
  return requestContext.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
