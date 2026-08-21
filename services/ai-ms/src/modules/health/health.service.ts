import { Injectable, Logger } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

/** Liveness of the ai-ms process. No persistence (FR-004). */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  check(): HealthStatus {
    this.logger.log('Health check requested');
    return { status: 'ok', service: 'ai-ms', timestamp: new Date().toISOString() };
  }
}
