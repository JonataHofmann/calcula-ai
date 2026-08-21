import { Injectable, Logger } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

/** Liveness of the api process. */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  check(): HealthStatus {
    this.logger.log('Health check requested');
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
  }
}
