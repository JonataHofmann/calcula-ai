import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('reports ok status', () => {
    const controller = new HealthController(new HealthService());
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
  });
});
