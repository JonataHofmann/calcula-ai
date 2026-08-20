import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const SIGNATURE_HEADER = 'x-webhook-signature';

/** Validates Pluggy webhook payload signatures (HMAC-SHA1 over the raw body) against PLUGGY_WEBHOOK_SECRET. */
@Injectable()
export class PluggyWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.PLUGGY_WEBHOOK_SECRET;
    if (!secret) {
      throw new UnauthorizedException({ code: 'WEBHOOK_NOT_CONFIGURED' });
    }

    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const signature = request.headers[SIGNATURE_HEADER];
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new UnauthorizedException({ code: 'MISSING_WEBHOOK_SIGNATURE' });
    }

    const payload = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
    const expected = createHmac('sha1', secret).update(payload).digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const isValid =
      expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);

    if (!isValid) {
      throw new UnauthorizedException({ code: 'INVALID_WEBHOOK_SIGNATURE' });
    }
    return true;
  }
}
