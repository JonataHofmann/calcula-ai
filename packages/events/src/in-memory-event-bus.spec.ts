import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from './in-memory-event-bus.js';
import type { DomainEvent } from './domain-event.js';

function makeEvent(): DomainEvent<{ amount: string }> {
  return {
    id: 'evt-1',
    name: 'TransactionCreated',
    occurredAt: new Date(),
    userId: 'user-1',
    payload: { amount: '100.00' },
  };
}

describe('InMemoryEventBus', () => {
  it('delivers event to subscriber', async () => {
    const bus = new InMemoryEventBus();
    const received: DomainEvent[] = [];
    bus.subscribe('TransactionCreated', (event) => {
      received.push(event);
    });

    await bus.publish(makeEvent());

    expect(received).toHaveLength(1);
    expect(received[0]?.name).toBe('TransactionCreated');
  });

  it('ignores events without subscribers', async () => {
    const bus = new InMemoryEventBus();
    await expect(bus.publish(makeEvent())).resolves.toBeUndefined();
  });

  it('supports multiple subscribers', async () => {
    const bus = new InMemoryEventBus();
    let count = 0;
    bus.subscribe('TransactionCreated', () => {
      count += 1;
    });
    bus.subscribe('TransactionCreated', () => {
      count += 1;
    });

    await bus.publish(makeEvent());

    expect(count).toBe(2);
  });
});
