import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates/parses request payloads with a Zod schema at the param boundary.
 * The global class-validator ValidationPipe skips plain-type params, so this
 * is what enforces the contract schemas on controllers.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
