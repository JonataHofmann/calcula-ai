import { Injectable, Logger } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  check(): HealthStatus {
    this.logger.debug('Health probe');
    return { status: 'ok', service: 'bff', timestamp: new Date().toISOString() };
  }
}
