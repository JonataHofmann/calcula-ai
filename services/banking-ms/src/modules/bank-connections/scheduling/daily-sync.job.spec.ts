import { DailySyncJob } from './daily-sync.job';
import type { BankConnectionsService } from '../bank-connections.service';

/**
 * Unit test — the job is a thin delegator to the service. The stale-connection
 * selection logic itself is covered in bank-connections.service.spec.ts
 * (syncStaleConnections) and, against a real driver, in the gated integration spec.
 */
describe('DailySyncJob', () => {
  it('delegates run() to service.syncStaleConnections', async () => {
    const service = { syncStaleConnections: jest.fn().mockResolvedValue(undefined) };
    const job = new DailySyncJob(service as unknown as BankConnectionsService);

    await job.run();

    expect(service.syncStaleConnections).toHaveBeenCalledTimes(1);
  });
});
