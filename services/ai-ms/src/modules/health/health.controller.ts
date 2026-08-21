import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService, type HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly health: HealthService) {}

  @Get()
  check(): HealthStatus {
    this.logger.log('GET /health');
    return this.health.check();
  }
}
