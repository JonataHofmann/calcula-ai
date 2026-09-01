import type { Repository } from 'typeorm';
import { SessionEntity } from '../../../database/session.entity';
import type { SessionTokens } from './session.store';
import { decryptTokens, deriveKey } from './token-crypto';
import { TypeormSessionStore } from './typeorm-session.store';

const SECRET = 'test-secret-with-at-least-32-chars!!';

const tokens: SessionTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  idToken: 'id',
  accessTokenExpiresAt: Date.now() + 300_000,
};

function makeFakeRepository() {
  const rows = new Map<string, SessionEntity>();
  const repo = {
    rows,
    create: (data: Partial<SessionEntity>) => Object.assign(new SessionEntity(), data),
    save: jest.fn(async (entity: SessionEntity) => {
      rows.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where: { id } }: { where: { id: string } }) => rows.get(id) ?? null),
    update: jest.fn(async ({ id }: { id: string }, patch: Partial<SessionEntity>) => {
      const row = rows.get(id);
      if (row) {
        Object.assign(row, patch);
      }
    }),
    delete: jest.fn(async (criteria: { id?: string }) => {
      if (criteria.id) {
        rows.delete(criteria.id);
      }
    }),
  };
  return repo as unknown as Repository<SessionEntity> & typeof repo;
}

describe('TypeormSessionStore', () => {
  it('creates a session with encrypted tokens', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const session = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    expect(session.keycloakUserId).toBe('kc-1');
    const row = repo.rows.get(session.id)!;
    expect(row.encryptedTokens).not.toContain('access');
    expect(decryptTokens(row.encryptedTokens, deriveKey(SECRET))).toEqual(tokens);
  });

  it('finds a session and decrypts tokens', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const created = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const found = await store.findById(created.id);
    expect(found?.tokens).toEqual(tokens);
  });

  it('returns null for unknown session', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    expect(await store.findById('missing')).toBeNull();
  });

  it('deletes session when tokens cannot be decrypted', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const created = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    repo.rows.get(created.id)!.encryptedTokens = 'corrupted';

    expect(await store.findById(created.id)).toBeNull();
    expect(repo.rows.has(created.id)).toBe(false);
  });

  it('updates tokens re-encrypting them', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const created = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const newTokens = { ...tokens, accessToken: 'new-access' };
    await store.updateTokens(created.id, newTokens);

    const found = await store.findById(created.id);
    expect(found?.tokens.accessToken).toBe('new-access');
  });

  it('slides the session expiry forward when a new expiresAt is given', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const created = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const slid = new Date(Date.now() + 30 * 60 * 1000);
    await store.updateTokens(created.id, { ...tokens, accessToken: 'new-access' }, slid);

    const found = await store.findById(created.id);
    expect(found?.tokens.accessToken).toBe('new-access');
    expect(found?.expiresAt.getTime()).toBe(slid.getTime());
  });

  it('throttles lastActivityAt updates under 60s', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const created = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const before = repo.rows.get(created.id)!.lastActivityAt;

    await store.touch(created.id, new Date(before.getTime() + 30_000));
    expect(repo.rows.get(created.id)!.lastActivityAt).toEqual(before);

    await store.touch(created.id, new Date(before.getTime() + 61_000));
    expect(repo.rows.get(created.id)!.lastActivityAt.getTime()).toBe(before.getTime() + 61_000);
  });

  it('deletes a session', async () => {
    const repo = makeFakeRepository();
    const store = new TypeormSessionStore(repo, SECRET);
    const created = await store.create({
      keycloakUserId: 'kc-1',
      tokens,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await store.delete(created.id);
    expect(await store.findById(created.id)).toBeNull();
  });
});
