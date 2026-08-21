import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService, type HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  check(): HealthStatus {
    this.logger.debug('GET /health');
    return this.health.check();
  }
}
