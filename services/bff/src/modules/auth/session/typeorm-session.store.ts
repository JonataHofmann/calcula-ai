import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { LessThan, type Repository } from 'typeorm';
import { SessionEntity } from '../../../database/session.entity';
import type { CreateSessionInput, Session, SessionStore, SessionTokens } from './session.store';
import { decryptTokens, deriveKey, encryptTokens } from './token-crypto';

export const SESSION_SECRET_TOKEN = Symbol('SESSION_SECRET');

const TOUCH_THROTTLE_MS = 60_000;
const CLEANUP_PROBABILITY = 0.01;

@Injectable()
export class TypeormSessionStore implements SessionStore {
  private readonly key: Buffer;

  constructor(
    @InjectRepository(SessionEntity)
    private readonly repository: Repository<SessionEntity>,
    @Inject(SESSION_SECRET_TOKEN) sessionSecret: string,
  ) {
    this.key = deriveKey(sessionSecret);
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date();
    const entity = this.repository.create({
      id: randomUUID(),
      keycloakUserId: input.keycloakUserId,
      encryptedTokens: encryptTokens(input.tokens, this.key),
      createdAt: now,
      lastActivityAt: now,
      expiresAt: input.expiresAt,
    });
    await this.repository.save(entity);
    void this.cleanupExpired();
    return this.toSession(entity, input.tokens);
  }

  async findById(id: string): Promise<Session | null> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      return null;
    }
    let tokens: SessionTokens;
    try {
      tokens = decryptTokens(entity.encryptedTokens, this.key);
    } catch {
      await this.repository.delete({ id });
      return null;
    }
    return this.toSession(entity, tokens);
  }

  async updateTokens(id: string, tokens: SessionTokens, expiresAt?: Date): Promise<void> {
    const patch: Partial<SessionEntity> = { encryptedTokens: encryptTokens(tokens, this.key) };
    if (expiresAt) patch.expiresAt = expiresAt;
    await this.repository.update({ id }, patch);
  }

  async touch(id: string, lastActivityAt: Date): Promise<void> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      return;
    }
    if (lastActivityAt.getTime() - entity.lastActivityAt.getTime() < TOUCH_THROTTLE_MS) {
      return;
    }
    await this.repository.update({ id }, { lastActivityAt });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private async cleanupExpired(): Promise<void> {
    if (Math.random() > CLEANUP_PROBABILITY) {
      return;
    }
    try {
      await this.repository.delete({ expiresAt: LessThan(new Date()) });
    } catch {
      // opportunistic cleanup; ignore failures
    }
  }

  private toSession(entity: SessionEntity, tokens: SessionTokens): Session {
    return {
      id: entity.id,
      keycloakUserId: entity.keycloakUserId,
      tokens,
      createdAt: entity.createdAt,
      lastActivityAt: entity.lastActivityAt,
      expiresAt: entity.expiresAt,
    };
  }
}
