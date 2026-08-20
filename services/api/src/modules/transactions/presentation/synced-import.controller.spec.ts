import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ServiceAccountGuard } from '../../../common/auth/service-account.guard';
import type { TokenVerifier } from '@finance/auth';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { SyncedImportConflictError } from '../domain/errors';
import { ImportSyncedTransactionUseCase } from '../application/use-cases/import-synced-transaction/import-synced-transaction';
import { importSyncedTransactionInput } from '../application/use-cases/import-synced-transaction/import-synced-transaction.schemas';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
} from '../application/use-cases/test-fakes';
import { TransactionsController } from './transactions.controller';

/**
 * "Integration" test per repo convention (no Nest TestingModule/supertest —
 * see cross-cutting-security.spec.ts): direct instantiation of the guard,
 * pipe, and controller wired to a real use case + in-memory fakes.
 */

function makeContext(headers: Record<string, string>): ExecutionContext {
  const req = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const ACCOUNT_ID = randomUUID();
const DEFAULT_EXPENSE_CATEGORY = randomUUID();

function makeController() {
  const transactions = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup().addDefault('expense', DEFAULT_EXPENSE_CATEGORY);
  const accounts = new FakeAccountLookup().add(ACCOUNT_ID, USER_A);
  const cards = new FakeCardLookup();
  const importSyncedTransaction = new ImportSyncedTransactionUseCase(
    transactions,
    categories,
    accounts,
    cards,
  );
  const controller = new TransactionsController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    importSyncedTransaction,
  );
  return { controller };
}

function validBody(over: Partial<Record<string, unknown>> = {}) {
  return {
    userId: USER_A,
    description: 'Supermercado',
    amount: '50.00',
    dueDate: new Date(Date.UTC(2026, 0, 10)).toISOString(),
    type: 'expense' as const,
    accountId: ACCOUNT_ID,
    creditCardId: null,
    source: 'synced' as const,
    externalId: randomUUID(),
    pluggyStatus: 'posted' as const,
    ...over,
  };
}

describe('POST /transactions/synced-import', () => {
  it('rejects with 401 when the caller lacks the svc-transactions-import role', () => {
    const verifier: TokenVerifier = {
      verify: async () => ({
        sub: 'svc-account',
        payload: { realm_access: { roles: ['some-other-role'] } },
      }),
    };
    const guard = new ServiceAccountGuard(verifier);
    const context = makeContext({ authorization: 'Bearer token' });
    return expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects with 400 for an invalid body', () => {
    const pipe = new ZodValidationPipe(importSyncedTransactionInput);
    expect(() => pipe.transform(validBody({ amount: 'not-a-number' }))).toThrow();
  });

  it('rejects with 400 when the Idempotency-Key header is missing', async () => {
    const { controller } = makeController();
    await expect(controller.createSyncedImport(undefined, validBody())).rejects.toMatchObject({
      response: { code: 'VALIDATION' },
    });
  });

  it('rejects with 409 when the Idempotency-Key is replayed with a different body', async () => {
    const { controller } = makeController();
    const body = validBody();
    await controller.createSyncedImport(`banking-ms:${body.externalId}`, body);

    await expect(
      controller.createSyncedImport(`banking-ms:${body.externalId}`, { ...body, amount: '999.00' }),
    ).rejects.toBeInstanceOf(SyncedImportConflictError);
  });

  it('replays the same result (200 semantics) when the same key and body are sent twice', async () => {
    const { controller } = makeController();
    const body = validBody();
    const first = await controller.createSyncedImport(`banking-ms:${body.externalId}`, body);
    const second = await controller.createSyncedImport(`banking-ms:${body.externalId}`, body);
    expect(second.id).toBe(first.id);
  });
});
