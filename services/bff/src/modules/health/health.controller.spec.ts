import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('reports ok status', () => {
    const controller = new HealthController(new HealthService());
    expect(controller.check().service).toBe('bff');
  });
});
