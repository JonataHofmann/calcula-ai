import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthStatus {
    return { status: 'ok', service: 'bff', timestamp: new Date().toISOString() };
  }
}
