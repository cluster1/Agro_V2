import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Request-pipeline configuration shared by main.ts and the HTTP tests, so the
 * tests exercise exactly what production runs (headers, cookies, validation,
 * error filter, route prefix).
 */
export function configureApp(app: INestApplication): void {
  // CORP is cross-origin because the frontend (another origin) loads /uploads images.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');
}
