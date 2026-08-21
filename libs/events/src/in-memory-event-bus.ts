import type { DomainEvent, EventName } from './domain-event.js';
import type { EventBus, EventHandler } from './event-bus.js';

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventName, EventHandler[]>();

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const handlers = this.handlers.get(event.name) ?? [];
    for (const handler of handlers) {
      await handler(event as DomainEvent);
    }
  }

  subscribe<TPayload>(name: EventName, handler: EventHandler<TPayload>): void {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(handler as EventHandler);
    this.handlers.set(name, handlers);
  }
}
