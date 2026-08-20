import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

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
    return { status: 'ok', service: 'banking-ms', timestamp: new Date().toISOString() };
  }
}
