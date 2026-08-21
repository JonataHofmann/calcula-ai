import type { DomainEvent, EventName } from './domain-event.js';

export type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => Promise<void> | void;

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(name: EventName, handler: EventHandler<TPayload>): void;
}
