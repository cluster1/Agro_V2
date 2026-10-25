import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Keeps HttpExceptions (validation, 4xx) as-is, but hides internals of
 * unexpected errors (DB errors, stack traces) from clients in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      return res.status(exception.getStatus()).json(exception.getResponse());
    }

    const err = exception as Error & { code?: string };
    this.logger.error(`${err?.message ?? 'Unknown error'}${err?.code ? ` [${err.code}]` : ''}`, err?.stack);

    const isProd = process.env.NODE_ENV === 'production';
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProd ? 'Internal server error' : err?.message ?? 'Internal server error',
    });
  }
}
