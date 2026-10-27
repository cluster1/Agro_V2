import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorBody, FIXED_MESSAGES, codeForStatus } from './error-codes';

/**
 * Turns every failure into `{ code, message, fields? }`. Messages for auth, not-found, throttling
 * and unexpected errors are fixed Indonesian text, so DB errors and stack traces never reach clients.
 * Business-rule (400/409) messages written by services are passed through.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return res.status(status).json(this.toBody(status, exception.getResponse()));
    }

    const err = exception as Error & { code?: string };
    this.logger.error(`${err?.message ?? 'Unknown error'}${err?.code ? ` [${err.code}]` : ''}`, err?.stack);

    const body: ErrorBody = { code: 'INTERNAL_ERROR', message: FIXED_MESSAGES.INTERNAL_ERROR! };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private toBody(status: number, response: string | object): ErrorBody {
    const r = (typeof response === 'string' ? { message: response } : response) as {
      code?: string;
      message?: string | string[];
      fields?: Record<string, string[]>;
    };

    // Already shaped by validationExceptionFactory
    if (r.code === 'VALIDATION_ERROR') return r as ErrorBody;

    const code = codeForStatus(status);
    const fixed = FIXED_MESSAGES[code];
    if (fixed) return { code, message: fixed };

    const message = Array.isArray(r.message) ? r.message.join('; ') : r.message;
    return { code, message: message || 'Permintaan tidak dapat diproses.' };
  }
}
